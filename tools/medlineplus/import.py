#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Do JSONL MedlinePlus da dich sang tieng Viet vao bang posts cua medicvn.com.

Chay lai duoc: moi bai duoc ghi nho trong bang import_sources theo
(source, source_id). Chay lan hai khong tao ban trung; neu ban dich doi
(content_hash khac) thi bai cu duoc cap nhat chu khong chen them.

    pip install "psycopg[binary]"   # hoac psycopg2-binary
    export DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/medicvn

    # xem truoc, khong ghi gi
    python3 import.py --in medlineplus.vi.jsonl --author admin@medicvn.com --dry-run

    # do that
    python3 import.py --in medlineplus.vi.jsonl --author admin@medicvn.com
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import sys
import unicodedata
from html.parser import HTMLParser
from typing import Any

SOURCE = "medlineplus"
ATTRIBUTION = "MedlinePlus - Thu vien Y hoc Quoc gia Hoa Ky (NLM)"

# Chuyen muc cha ben trang tin, da duoc migration 0008 gieo san.
PARENT_SLUG = "cam-nang-suc-khoe"

# -------------------------------------------------------------------------
# Ban do nhom chu de MedlinePlus -> chuyen muc con tieng Viet.
#
# So dau la do uu tien khi mot bai thuoc nhieu nhom: benh ly va he co quan
# xep truoc nhom nhan khau ("Women", "Seniors"), vi "Dai thao duong" mo ta
# bai sat hon "Suc khoe nu gioi".
# -------------------------------------------------------------------------
GROUP_MAP: dict[str, tuple[int, str]] = {
    # Benh ly va roi loan
    "Cancers": (10, "Ung thu"),
    "Diabetes Mellitus": (10, "Dai thao duong"),
    "Infections": (10, "Benh nhiem trung"),
    "Mental Health and Behavior": (10, "Suc khoe tam than"),
    "Metabolic Problems": (10, "Roi loan chuyen hoa"),
    "Genetics/Birth Defects": (10, "Di truyen - Di tat bam sinh"),
    "Injuries and Wounds": (10, "Chan thuong - Vet thuong"),
    "Substance Abuse Problems": (10, "Lam dung chat"),
    "Poisoning, Toxicology, Environmental Health": (10, "Ngo doc - Moi truong"),
    # He co quan
    "Blood, Heart and Circulation": (20, "Tim mach - Mau"),
    "Bones, Joints and Muscles": (20, "Co xuong khop"),
    "Brain and Nerves": (20, "Than kinh - Nao bo"),
    "Digestive System": (20, "Tieu hoa"),
    "Ear, Nose and Throat": (20, "Tai mui hong"),
    "Endocrine System": (20, "Noi tiet"),
    "Eyes and Vision": (20, "Mat - Thi luc"),
    "Immune System": (20, "Mien dich"),
    "Kidneys and Urinary System": (20, "Than - Tiet nieu"),
    "Lungs and Breathing": (20, "Ho hap"),
    "Mouth and Teeth": (20, "Rang mieng"),
    "Skin, Hair and Nails": (20, "Da - Toc - Mong"),
    "Female Reproductive System": (20, "Suc khoe sinh san nu"),
    "Male Reproductive System": (20, "Suc khoe sinh san nam"),
    "Pregnancy and Reproduction": (20, "Thai ky - Sinh san"),
    # Chan doan va dieu tri
    "Diagnostic Tests": (30, "Xet nghiem - Chan doan"),
    "Drugs and Supplements": (30, "Thuoc - Thuc pham bo sung"),
    "Surgery and Rehabilitation": (30, "Phau thuat - Phuc hoi chuc nang"),
    "Transplantation and Donation": (30, "Ghep tang - Hien tang"),
    "Complementary and Integrative Medicine": (30, "Y hoc bo sung"),
    # Song khoe
    "Food and Nutrition": (40, "Dinh duong"),
    "Fitness and Exercise": (40, "Van dong - The luc"),
    "Wellness and Lifestyle": (40, "Loi song lanh manh"),
    "Personal Health Issues": (40, "Cham soc ca nhan"),
    "Safety Issues": (40, "An toan"),
    "Social/Family Issues": (40, "Gia dinh - Xa hoi"),
    "Disasters": (40, "Thien tai - Tham hoa"),
    "Health System": (40, "He thong y te"),
    # Nhom nguoi
    "Children and Teenagers": (50, "Tre em - Vi thanh nien"),
    "Seniors": (50, "Nguoi cao tuoi"),
    "Women": (50, "Suc khoe nu gioi"),
    "Men": (50, "Suc khoe nam gioi"),
    "Population Groups": (50, "Nhom dan cu"),
    # Bon nhom nua xuat hien trong du lieu thuc te. "Symptoms" de uu tien
    # thap: bai thuoc nhom nay hau het cung thuoc mot he co quan, va
    # "Tieu hoa" mo ta bai sat hon "Trieu chung thuong gap".
    "Substance Use and Disorders": (10, "Su dung chat gay nghien"),
    "Drug Therapy": (30, "Dieu tri bang thuoc"),
    "Complementary and Alternative Therapies": (30, "Y hoc bo sung va thay the"),
    "Symptoms": (45, "Trieu chung thuong gap"),
}

# Dau tieng Viet cho ten chuyen muc. Giu rieng de phan GROUP_MAP o tren
# doc duoc tren moi terminal, con ten ghi vao CSDL thi co dau day du.
ACCENTED: dict[str, str] = {
    "Ung thu": "Ung thư",
    "Dai thao duong": "Đái tháo đường",
    "Benh nhiem trung": "Bệnh nhiễm trùng",
    "Suc khoe tam than": "Sức khỏe tâm thần",
    "Roi loan chuyen hoa": "Rối loạn chuyển hóa",
    "Di truyen - Di tat bam sinh": "Di truyền - Dị tật bẩm sinh",
    "Chan thuong - Vet thuong": "Chấn thương - Vết thương",
    "Lam dung chat": "Lạm dụng chất",
    "Ngo doc - Moi truong": "Ngộ độc - Môi trường",
    "Tim mach - Mau": "Tim mạch - Máu",
    "Co xuong khop": "Cơ xương khớp",
    "Than kinh - Nao bo": "Thần kinh - Não bộ",
    "Tieu hoa": "Tiêu hóa",
    "Tai mui hong": "Tai mũi họng",
    "Noi tiet": "Nội tiết",
    "Mat - Thi luc": "Mắt - Thị lực",
    "Mien dich": "Miễn dịch",
    "Than - Tiet nieu": "Thận - Tiết niệu",
    "Ho hap": "Hô hấp",
    "Rang mieng": "Răng miệng",
    "Da - Toc - Mong": "Da - Tóc - Móng",
    "Suc khoe sinh san nu": "Sức khỏe sinh sản nữ",
    "Suc khoe sinh san nam": "Sức khỏe sinh sản nam",
    "Thai ky - Sinh san": "Thai kỳ - Sinh sản",
    "Xet nghiem - Chan doan": "Xét nghiệm - Chẩn đoán",
    "Thuoc - Thuc pham bo sung": "Thuốc - Thực phẩm bổ sung",
    "Phau thuat - Phuc hoi chuc nang": "Phẫu thuật - Phục hồi chức năng",
    "Ghep tang - Hien tang": "Ghép tạng - Hiến tặng",
    "Y hoc bo sung": "Y học bổ sung",
    "Dinh duong": "Dinh dưỡng",
    "Van dong - The luc": "Vận động - Thể lực",
    "Loi song lanh manh": "Lối sống lành mạnh",
    "Cham soc ca nhan": "Chăm sóc cá nhân",
    "An toan": "An toàn",
    "Gia dinh - Xa hoi": "Gia đình - Xã hội",
    "Thien tai - Tham hoa": "Thiên tai - Thảm họa",
    "He thong y te": "Hệ thống y tế",
    "Tre em - Vi thanh nien": "Trẻ em - Vị thành niên",
    "Nguoi cao tuoi": "Người cao tuổi",
    "Suc khoe nu gioi": "Sức khỏe nữ giới",
    "Suc khoe nam gioi": "Sức khỏe nam giới",
    "Nhom dan cu": "Nhóm dân cư",
    "Su dung chat gay nghien": "Sử dụng chất gây nghiện",
    "Dieu tri bang thuoc": "Điều trị bằng thuốc",
    "Y hoc bo sung va thay the": "Y học bổ sung và thay thế",
    "Trieu chung thuong gap": "Triệu chứng thường gặp",
}

# -------------------------------------------------------------------------
# Emoji cho tung chuyen muc.
#
# Khong chi de trang tri sidebar: thieu anh, giao dien dung emoji nay lam
# tam diem cho tam bia mau tu sinh cua moi bai. Chuyen muc khong co emoji
# thi bia tro thanh mot mang mau tron.
# -------------------------------------------------------------------------
ICONS: dict[str, str] = {
    "Ung thư": "🎗️",
    "Đái tháo đường": "🩸",
    "Bệnh nhiễm trùng": "🦠",
    "Sức khỏe tâm thần": "🧩",
    "Rối loạn chuyển hóa": "⚗️",
    "Di truyền - Dị tật bẩm sinh": "🧬",
    "Chấn thương - Vết thương": "🩹",
    "Lạm dụng chất": "⚠️",
    "Sử dụng chất gây nghiện": "🚭",
    "Ngộ độc - Môi trường": "☣️",
    "Tim mạch - Máu": "❤️",
    "Cơ xương khớp": "🦴",
    "Thần kinh - Não bộ": "🧠",
    "Tiêu hóa": "🍽️",
    "Tai mũi họng": "👂",
    "Nội tiết": "🧫",
    "Mắt - Thị lực": "👁️",
    "Miễn dịch": "🛡️",
    "Thận - Tiết niệu": "💧",
    "Hô hấp": "🫁",
    "Răng miệng": "🦷",
    "Da - Tóc - Móng": "🧴",
    "Sức khỏe sinh sản nữ": "♀️",
    "Sức khỏe sinh sản nam": "♂️",
    "Thai kỳ - Sinh sản": "🤰",
    "Xét nghiệm - Chẩn đoán": "🔬",
    "Thuốc - Thực phẩm bổ sung": "💊",
    "Điều trị bằng thuốc": "💊",
    "Phẫu thuật - Phục hồi chức năng": "🏥",
    "Ghép tạng - Hiến tặng": "🫀",
    "Y học bổ sung": "🌿",
    "Y học bổ sung và thay thế": "🌿",
    "Dinh dưỡng": "🥗",
    "Vận động - Thể lực": "🏃",
    "Lối sống lành mạnh": "🌱",
    "Chăm sóc cá nhân": "🧼",
    "An toàn": "🦺",
    "Gia đình - Xã hội": "👨‍👩‍👧",
    "Thiên tai - Thảm họa": "🌪️",
    "Hệ thống y tế": "🏛️",
    "Trẻ em - Vị thành niên": "🧒",
    "Người cao tuổi": "🧓",
    "Sức khỏe nữ giới": "👩",
    "Sức khỏe nam giới": "👨",
    "Nhóm dân cư": "👥",
    "Triệu chứng thường gặp": "🤒",
}


# -------------------------------------------------------------------------
# slug / search_text - ban sao cua backend/src/lib/slugify.ts.
# Hai ben phai sinh ra cung mot chuoi, neu khong bai nhap bang script se co
# slug khac kieu voi bai dang tu giao dien.
# -------------------------------------------------------------------------
def deaccent(value: str) -> str:
    out = unicodedata.normalize("NFD", value)
    out = "".join(ch for ch in out if unicodedata.category(ch) != "Mn")
    return out.replace("đ", "d").replace("Đ", "D")


def slugify(value: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", deaccent(value).lower()))


def to_search_text(*parts: str | None) -> str:
    joined = " ".join(p for p in parts if p)
    stripped = re.sub(r"<[^>]+>", " ", deaccent(joined))
    return re.sub(r"\s+", " ", stripped).strip().lower()[:20000]


# -------------------------------------------------------------------------
# Loc HTML.
#
# Backend lam sach bang sanitize-html khi bai di qua API. Script nay ghi
# thang vao bang posts nen phai tu lam - cung danh sach the, va mo hinh dich
# co tra ve the la thi o day cat bo.
# -------------------------------------------------------------------------
KEEP_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
}
VOID_TAGS = {"br", "hr"}
# h1 thanh h2: tieu de bai da la h1 tren trang chi tiet.
REMAP_TAGS = {"h1": "h2"}
# Bo ca noi dung ben trong, khong chi cai the.
DROP_TREE = {"script", "style", "iframe", "object", "embed", "form"}
# HTML cho phep bo qua the dong cua li, p, td... Neu khong tu dong chung lai
# thi <li>mot<li>hai sinh ra </li></li> long nhau.
AUTO_CLOSE: dict[str, set[str]] = {
    "li": {"li"},
    "p": {"p"},
    "tr": {"tr", "td", "th"},
    "td": {"td", "th"},
    "th": {"td", "th"},
}


class Cleaner(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open_tags: list[str] = []
        self.dropping = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in DROP_TREE:
            self.dropping += 1
            return
        if self.dropping:
            return
        tag = REMAP_TAGS.get(tag, tag)
        if tag not in KEEP_TAGS:
            return
        if tag in VOID_TAGS:
            self.out.append(f"<{tag}>")
            return
        peers = AUTO_CLOSE.get(tag)
        while peers and self.open_tags and self.open_tags[-1] in peers:
            self.out.append(f"</{self.open_tags.pop()}>")
        self.open_tags.append(tag)
        self.out.append(f"<{tag}>")

    def handle_startendtag(self, tag: str, attrs: Any) -> None:
        if not self.dropping and tag in VOID_TAGS:
            self.out.append(f"<{tag}>")

    def handle_endtag(self, tag: str) -> None:
        if tag in DROP_TREE:
            self.dropping = max(0, self.dropping - 1)
            return
        if self.dropping:
            return
        tag = REMAP_TAGS.get(tag, tag)
        if tag not in KEEP_TAGS or tag in VOID_TAGS:
            return
        if tag not in self.open_tags:
            return
        # Dong ca cac the con con bo ngo, neu khong HTML tra ve se leo thang.
        while self.open_tags:
            current = self.open_tags.pop()
            self.out.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data: str) -> None:
        if not self.dropping:
            self.out.append(html.escape(data, quote=False))

    def result(self) -> str:
        while self.open_tags:
            self.out.append(f"</{self.open_tags.pop()}>")
        return "".join(self.out)


def clean_html(raw: str) -> str:
    parser = Cleaner()
    parser.feed(raw or "")
    parser.close()
    text = parser.result()
    text = re.sub(r"<p>\s*</p>", "", text)
    return re.sub(r"\s+\n", "\n", text).strip()


def strip_tags(raw: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", raw or "")).strip()


def excerpt_of(rec: dict[str, Any], body_text: str) -> str:
    desc = (rec.get("short_description") or "").strip()
    if not desc:
        desc = body_text[:400]
    desc = strip_tags(desc)
    return desc[:497] + "..." if len(desc) > 500 else desc


def footer_html(rec: dict[str, Any]) -> str:
    title_en = html.escape(rec.get("title_en") or rec.get("title") or "")
    url = html.escape(rec.get("url") or "https://medlineplus.gov/")
    inst = (rec.get("primary_institute") or "").strip()
    inst_part = f" Cơ quan chủ trì nội dung gốc: {html.escape(inst)}." if inst else ""
    return (
        "<blockquote><p><strong>Nguồn:</strong> Bài viết được medicvn.com biên dịch từ "
        f'chuyên đề “{title_en}” của MedlinePlus, Thư viện Y học Quốc gia Hoa Kỳ (NLM) — '
        f'<a href="{url}" target="_blank" rel="noopener noreferrer nofollow">{url}</a>.'
        f"{inst_part} Nội dung gốc thuộc phạm vi công cộng; bản dịch tiếng Việt là sản phẩm "
        "của medicvn.com. Bài viết chỉ mang tính tham khảo, không thay thế chẩn đoán và chỉ "
        "định của bác sĩ.</p></blockquote>"
    )


def also_called_html(rec: dict[str, Any]) -> str:
    names = [n.strip() for n in (rec.get("also_called_vi") or rec.get("also_called") or []) if n.strip()]
    if not names:
        return ""
    return "<p><em>Tên gọi khác: " + html.escape(", ".join(names)) + "</em></p>"


def pick_group(rec: dict[str, Any]) -> str | None:
    best: tuple[int, str] | None = None
    for group in rec.get("groups") or []:
        entry = GROUP_MAP.get(group.strip())
        if entry and (best is None or entry[0] < best[0]):
            best = entry
    if best:
        return ACCENTED.get(best[1], best[1])
    # Nhom la: giu ten goc de admin doi ten trong trang quan tri.
    raw = [g.strip() for g in (rec.get("groups") or []) if g.strip()]
    return raw[0] if raw else None


# -------------------------------------------------------------------------
# CSDL
# -------------------------------------------------------------------------
def connect(dsn: str):
    try:
        import psycopg  # type: ignore

        return psycopg.connect(dsn), "psycopg3"
    except ImportError:
        pass
    try:
        import psycopg2  # type: ignore

        return psycopg2.connect(dsn), "psycopg2"
    except ImportError as exc:
        raise SystemExit('thieu thu vien: pip install "psycopg[binary]"') from exc


DDL = """
CREATE TABLE IF NOT EXISTS import_sources (
  source      varchar(32)  NOT NULL,
  source_id   varchar(128) NOT NULL,
  content_hash varchar(64) NOT NULL,
  source_url  text,
  post_id     uuid REFERENCES posts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, source_id)
);
"""


def ensure_parent(cur) -> str:
    cur.execute("SELECT id FROM categories WHERE slug = %s AND surface = 'portal'", (PARENT_SLUG,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO categories (name, slug, icon, description, surface, sort_order)
           VALUES ('Cẩm nang sức khỏe', %s, '📖',
                   'Hướng dẫn chăm sóc sức khỏe thường ngày', 'portal', 3)
           RETURNING id""",
        (PARENT_SLUG,),
    )
    return cur.fetchone()[0]


def ensure_category(cur, cache: dict[str, str], parent_id: str, name: str, order: int) -> str:
    if name in cache:
        return cache[name]
    cur.execute("SELECT id FROM categories WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        cache[name] = row[0]
        return row[0]
    slug = slugify(name)[:100] or f"muc-{abs(hash(name)) % 10**6}"
    cur.execute("SELECT 1 FROM categories WHERE slug = %s", (slug,))
    if cur.fetchone():
        slug = f"{slug[:92]}-mlp"
    cur.execute(
        """INSERT INTO categories (name, slug, icon, parent_id, surface, sort_order)
           VALUES (%s, %s, %s, %s, 'portal', %s) RETURNING id""",
        (name[:100], slug, ICONS.get(name), parent_id, order),
    )
    cache[name] = cur.fetchone()[0]
    return cache[name]


def backfill_icons(cur) -> int:
    """Gan emoji cho chuyen muc da tao o lan chay truoc ma chua co icon.

    ensure_category chi chay voi bai dang duoc nhap; bai da nhap thi bo qua
    tu som, nen chuyen muc cu se khong bao gio duoc dung toi. Mot vong quet
    rieng, chay duoc nhieu lan, la du.
    """
    n = 0
    for name, icon in ICONS.items():
        cur.execute(
            """UPDATE categories SET icon = %s, updated_at = now()
               WHERE name = %s AND surface = 'portal'
                 AND (icon IS NULL OR icon = '')""",
            (icon, name),
        )
        n += cur.rowcount or 0
    return n


def unique_slug(cur, base: str, post_id: str | None) -> str:
    base = (base or "bai-viet")[:240]
    candidate = base
    n = 1
    while True:
        if post_id:
            cur.execute("SELECT 1 FROM posts WHERE slug = %s AND id <> %s", (candidate, post_id))
        else:
            cur.execute("SELECT 1 FROM posts WHERE slug = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        n += 1
        candidate = f"{base[:246]}-{n}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="medlineplus.vi.jsonl")
    ap.add_argument("--dsn", default=os.environ.get("DATABASE_URL", ""))
    ap.add_argument("--author", required=True, help="email tai khoan dung lam tac gia")
    ap.add_argument("--status", default="pending", choices=["pending", "approved"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dsn:
        print("thieu DATABASE_URL hoac --dsn", file=sys.stderr)
        return 2

    records: list[dict[str, Any]] = []
    with open(args.src, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                records.append(json.loads(line))
            if args.limit and len(records) >= args.limit:
                break
    print(f"doc duoc {len(records)} ban ghi tu {args.src}")

    conn, driver = connect(args.dsn)
    conn.autocommit = False
    cur = conn.cursor()
    # CSDL dang o encoding SQL_ASCII, nen psycopg3 tra MOI cot text ve bytes.
    # Moi phep so sanh chuoi deu truot: vai tro tai khoan, va ca content_hash
    # (khien lan chay sau khong nhan ra bai da nhap, ghi de lai tu dau).
    cur.execute("SET client_encoding TO 'UTF8'")
    cur.execute(DDL)

    cur.execute("SELECT id, role::text FROM users WHERE email = %s", (args.author,))
    row = cur.fetchone()
    if not row:
        print(f"khong tim thay tai khoan {args.author}", file=sys.stderr)
        conn.rollback()
        return 2
    author_id, role = row
    if role not in ("admin", "moderator", "doctor"):
        print(f"tai khoan {args.author} co vai tro '{role}' - trang tin chi nhan "
              "bai cua admin/moderator/doctor", file=sys.stderr)
        conn.rollback()
        return 2

    parent_id = ensure_parent(cur)
    if not args.dry_run:
        filled = backfill_icons(cur)
        if filled:
            print(f"da gan emoji cho {filled} chuyen muc")
    cat_cache: dict[str, str] = {}
    unknown_groups: set[str] = set()

    inserted = updated = skipped = 0
    order = 10

    for rec in records:
        source_id = str(rec.get("source_id") or "").strip()
        if not source_id:
            skipped += 1
            continue

        body = clean_html(rec.get("content_html") or "")
        if not body:
            skipped += 1
            continue

        content = also_called_html(rec) + body + footer_html(rec)
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()

        cur.execute(
            "SELECT post_id, content_hash FROM import_sources WHERE source = %s AND source_id = %s",
            (SOURCE, source_id),
        )
        existing = cur.fetchone()
        if existing and existing[1] == digest:
            skipped += 1
            continue

        title = (rec.get("title") or "").strip()[:255]
        body_text = strip_tags(body)
        excerpt = excerpt_of(rec, body_text)
        search_text = to_search_text(title, excerpt, body_text)

        group_name = pick_group(rec)
        if group_name and group_name not in ACCENTED.values():
            if group_name not in GROUP_MAP:
                unknown_groups.add(group_name)

        if args.dry_run:
            print(f"  [{'CAP NHAT' if existing else 'THEM'}] {title}"
                  f"  ->  {group_name or 'Cẩm nang sức khỏe'}  ({len(body_text)} ky tu)")
            inserted += 0 if existing else 1
            updated += 1 if existing else 0
            continue

        category_id = parent_id
        if group_name:
            order += 10
            category_id = ensure_category(cur, cat_cache, parent_id, group_name, order)

        if existing and existing[0]:
            post_id = existing[0]
            slug = unique_slug(cur, slugify(title), post_id)
            cur.execute(
                """UPDATE posts SET title = %s, slug = %s, content = %s, excerpt = %s,
                       search_text = %s, category_id = %s, surface = 'portal',
                       post_type = 'article', updated_at = now()
                   WHERE id = %s""",
                (title, slug, content, excerpt, search_text, category_id, post_id),
            )
            cur.execute(
                """UPDATE import_sources SET content_hash = %s, source_url = %s, updated_at = now()
                   WHERE source = %s AND source_id = %s""",
                (digest, rec.get("url"), SOURCE, source_id),
            )
            updated += 1
        else:
            slug = unique_slug(cur, slugify(title), None)
            cur.execute(
                """INSERT INTO posts
                     (title, slug, content, excerpt, post_type, status, search_text,
                      is_anonymous, surface, is_published, author_id, category_id)
                   VALUES (%s, %s, %s, %s, 'article', %s::poststatus, %s, false, 'portal', true, %s, %s)
                   RETURNING id""",
                (title, slug, content, excerpt, args.status, search_text, author_id, category_id),
            )
            post_id = cur.fetchone()[0]
            cur.execute(
                """INSERT INTO import_sources (source, source_id, content_hash, source_url, post_id)
                   VALUES (%s, %s, %s, %s, %s)
                   ON CONFLICT (source, source_id) DO UPDATE
                     SET content_hash = EXCLUDED.content_hash,
                         source_url  = EXCLUDED.source_url,
                         post_id     = EXCLUDED.post_id,
                         updated_at  = now()""",
                (SOURCE, source_id, digest, rec.get("url"), post_id),
            )
            inserted += 1

    if args.dry_run:
        conn.rollback()
        print("\n-- dry-run: khong ghi gi vao CSDL --")
    else:
        conn.commit()

    print(f"\ndriver    : {driver}")
    print(f"them moi  : {inserted}")
    print(f"cap nhat  : {updated}")
    print(f"bo qua    : {skipped}")
    print(f"trang thai: {args.status}")
    if unknown_groups:
        print("\nnhom chua co ten tieng Viet (doi ten trong trang quan tri, "
              "hoac them vao GROUP_MAP):")
        for g in sorted(unknown_groups):
            print(f"  - {g}")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
