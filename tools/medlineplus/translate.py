#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dich JSONL MedlinePlus (tieng Anh) sang tieng Viet bang Google Gemini.

Vi sao phai dich chu khong "viet lai":
    Ban tom tat chu de cua MedlinePlus do NIH/NLM soan va thuoc pham vi cong
    cong (public domain) - dung lai duoc, ke ca cho muc dich thuong mai. Ban
    dich tieng Viet la tac pham phai sinh do chinh ban tao ra: khong trung
    voi bat ky trang tieng Viet nao dang co, nen Google khong coi la noi dung
    sao chep, va ban giu quyen doi voi ban dich do.

    LUU Y BAN QUYEN: chi dung phan "health topic summary" trong file XML.
    Medical Encyclopedia (A.D.A.M.) va Drug Information (ASHP) tren
    medlineplus.gov la cua ben thu ba, KHONG thuoc public domain.

Chay lai duoc nhieu lan: bai nao dich roi (theo source_id) thi bo qua, nen
dut mang giua chung chi can chay lai cung lenh.

    pip install google-genai
    export GEMINI_API_KEY=AIza...
    python3 translate.py --in medlineplus.jsonl --out medlineplus.vi.jsonl --limit 5
    python3 translate.py --in medlineplus.jsonl --out medlineplus.vi.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import random
import re
import sys
import threading
import time
import unicodedata
from typing import Any

# Flash du cho viec dich va re hon Pro nhieu lan. Doi sang "gemini-2.5-pro"
# bang --model neu thay ban dich con cung.
MODEL_DEFAULT = "gemini-2.5-flash"

# Moi model co bucket RPM/RPD RIENG. Goi mien phi cho mot model Flash chi
# 20 luot/ngay - khong bao gio du cho 1009 bai. Gop nhieu model lai thi
# tran ngay cong don, va hai model Flash Lite (500/ngay moi cai) ganh phan
# lon. Chay --list-models truoc de lay dung ten model tai khoan ban co.
# Cu phap moi muc: ten:rpm:rpd
MODELS_DEFAULT = (
    "gemini-3.5-flash-lite:15:500,"
    "gemini-3.1-flash-lite:15:500,"
    "gemini-3.8-flash:5:20,"
    "gemini-3.7-flash:5:20,"
    "gemini-3.6-flash:5:20,"
    "gemini-3.5-flash:5:20,"
    "gemini-3-flash-preview:5:20,"
    "gemini-2.5-flash-lite:10:20,"
    "gemini-2.5-flash:5:20"
)

# The tags backend/src/lib/sanitize.ts keeps. Anything else the model emits is
# stripped later by import.py, so ask for this set up front.
ALLOWED_TAGS = "p, h2, h3, h4, ul, ol, li, strong, em, br, blockquote, table, thead, tbody, tr, th, td"

SYSTEM_PROMPT = f"""Bạn là biên tập viên y khoa của medicvn.com, một trang tin sức khỏe tiếng Việt.

Nhiệm vụ: dịch một bài sức khỏe của MedlinePlus (Thư viện Y học Quốc gia Hoa Kỳ) sang tiếng Việt.

QUY TẮC QUAN TRỌNG NHẤT
- Viết tiếng Việt CÓ DẤU ĐẦY ĐỦ, đúng chính tả, ở mọi trường — kể cả title.
  "Phá thai" chứ không phải "Pha thai"; "Áp xe" chứ không phải "Ap xe";
  "Mụn trứng cá" chứ không phải "Mun trung ca".

YÊU CẦU VỀ NỘI DUNG
- Dịch đúng ý, không thêm bớt thông tin y khoa. Không tự bổ sung số liệu,
  thuốc, liều dùng hay khuyến cáo nào không có trong bản gốc.
- Giữ nguyên mọi con số, đơn vị và ngưỡng xét nghiệm (5,7% — 120/80 — 4 giờ).
- Đổi đơn vị Mỹ sang đơn vị quen thuộc ở Việt Nam và ghi cả hai:
  "9 pounds" -> "4,1 kg (9 pound)".
- Đổi đầu mối địa phương Mỹ sang Việt Nam: "call 911" -> "gọi cấp cứu 115".
  Tên cơ quan Mỹ (CDC, NIH, FDA) thì giữ nguyên và giải thích ngắn một lần ở
  lần xuất hiện đầu tiên, vì đó là nguồn của bài.
- Bỏ các câu chỉ đúng với dân số Mỹ (ví dụ danh sách chủng tộc có nguy cơ cao)
  hoặc diễn đạt lại cho trung tính: "một số nhóm dân cư có nguy cơ cao hơn".

YÊU CẦU VỀ GIỌNG VĂN
- Tiếng Việt tự nhiên, rõ ràng, người không học y đọc là hiểu. Không dịch từng
  chữ theo cấu trúc tiếng Anh.
- Xưng hô trung tính: "bạn", "người bệnh". Không dùng "quý khách", không dùng "tôi".
- "health care provider" -> "bác sĩ" hoặc "nhân viên y tế".
- Thuật ngữ theo cách gọi phổ biến tại Việt Nam: đường huyết, tăng huyết áp,
  đột quỵ, tiểu đường type 2, tâm thu / tâm trương, xét nghiệm HbA1c. Lần đầu
  xuất hiện một thuật ngữ chuyên môn, mở ngoặc thêm tên tiếng Anh.
- Câu ngắn. Tránh "việc", "sự", "được" thừa.

YÊU CẦU VỀ ĐỊNH DẠNG
- content_html chỉ được dùng các thẻ: {ALLOWED_TAGS}.
- Không dùng h1 (tiêu đề bài đã nằm ở trường title).
- Không chèn thẻ <a>, không chèn ảnh, không chèn style hay class.
- Mỗi câu hỏi làm đề mục thì đặt trong <h2>.
- Không giữ dòng "NIH: ..." ở cuối bài — hệ thống tự gắn phần ghi nguồn.

CÁC TRƯỜNG PHẢI TRẢ VỀ
- title            : tiêu đề tiếng Việt có dấu, 8-70 ký tự, không dấu chấm cuối
- short_description: tóm tắt 1-2 câu, tối đa 200 ký tự
- also_called      : các tên gọi khác bằng tiếng Việt, giữ cả tên viết tắt tiếng Anh
- content_html     : thân bài"""

# Gemini nhan JSON Schema va tra ve dung khuon nay, khong can go ```json.
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "short_description": {"type": "string"},
        "also_called": {"type": "array", "items": {"type": "string"}},
        "content_html": {"type": "string"},
    },
    "required": ["title", "short_description", "also_called", "content_html"],
}


def build_user_prompt(rec: dict[str, Any]) -> str:
    parts = [f"Tieu de goc: {rec.get('title', '')}"]
    also = rec.get("also_called") or []
    if also:
        parts.append("Ten goi khac (goc): " + "; ".join(also))
    groups = rec.get("groups") or []
    if groups:
        parts.append("Nhom chu de: " + "; ".join(groups))
    body = (rec.get("content_html") or "").strip() or (rec.get("content_text") or "").strip()
    parts.append("\nNoi dung goc:\n" + body)
    return "\n".join(parts)


JSON_BLOCK = re.compile(r"\{.*\}", re.S)


def parse_reply(text: str) -> dict[str, Any]:
    """response_schema gan nhu luon tra JSON sach; phan con lai la luoi do."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\s*|\s*```$", "", text, flags=re.S)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = JSON_BLOCK.search(text)
        if not m:
            raise
        return json.loads(m.group(0))


def validate(out: dict[str, Any]) -> None:
    for field in ("title", "content_html"):
        if not isinstance(out.get(field), str) or not out[field].strip():
            raise ValueError(f"thieu truong {field}")
    if len(out["title"]) > 200:
        raise ValueError("title qua dai")
    desc = out.get("short_description") or ""
    if len(desc) > 500:
        out["short_description"] = desc[:497] + "..."
    if not isinstance(out.get("also_called"), list):
        out["also_called"] = []


class ModelPool:
    """Xep lich request tren nhieu model cung luc.

    Moi model giu rieng: khoang cach toi thieu giua hai request (RPM), so luot
    con lai trong ngay (RPD), va co "chet" khi Google bao het han muc ngay.
    acquire() chon model ranh som nhat, dat truoc mot cho theo dong ho roi ngu
    toi luot - nen khong bao gio dam vao 429 vi qua nhanh, va khi mot model can
    thi cong viec tu chay tiep tren model con lai.
    """

    def __init__(self, specs: list[tuple[str, float, int]]) -> None:
        self.lock = threading.Lock()
        self.slots = [
            {
                "name": name,
                "interval": 60.0 / rpm if rpm > 0 else 0.0,
                "next_at": 0.0,
                "left": rpd,
                "dead": False,
                "done": 0,
            }
            for name, rpm, rpd in specs
        ]

    def acquire(self) -> str | None:
        with self.lock:
            alive = [s for s in self.slots if not s["dead"] and s["left"] > 0]
            if not alive:
                return None
            slot = min(alive, key=lambda s: s["next_at"])
            start = max(time.monotonic(), slot["next_at"])
            slot["next_at"] = start + slot["interval"]
            slot["left"] -= 1
            name = str(slot["name"])
        delay = start - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        return name

    def penalise(self, name: str, exc: Exception) -> None:
        text = str(exc)
        with self.lock:
            for slot in self.slots:
                if slot["name"] != name:
                    continue
                if "PerDay" in text:
                    slot["dead"] = True
                    slot["left"] = 0
                    print(f"  het han muc NGAY: {name}", file=sys.stderr, flush=True)
                else:
                    m = RETRY_DELAY.search(text)
                    pause = float(m.group(1)) + 2 if m else 30.0
                    slot["next_at"] = max(slot["next_at"], time.monotonic() + pause)
                break

    def mark_ok(self, name: str) -> None:
        with self.lock:
            for slot in self.slots:
                if slot["name"] == name:
                    slot["done"] = int(slot["done"]) + 1
                    break

    def report(self) -> str:
        with self.lock:
            return "\n".join(
                f"  {s['name']:<28} xong {s['done']:>4}   con {s['left']:>4}"
                + ("   (het han muc ngay)" if s["dead"] else "")
                for s in self.slots
            )


class RateLimiter:
    def __init__(self, rpm: float) -> None:
        self.interval = 60.0 / rpm if rpm > 0 else 0.0
        self.lock = threading.Lock()
        self.next_at = 0.0

    def wait(self) -> None:
        if not self.interval:
            return
        with self.lock:
            start = max(time.monotonic(), self.next_at)
            self.next_at = start + self.interval
        delay = start - time.monotonic()
        if delay > 0:
            time.sleep(delay)


RETRY_DELAY = re.compile(r"'retryDelay': '(\d+(?:\.\d+)?)s'")


def has_dau(text: str) -> bool:
    """Chuoi co chua dau tieng Viet hay khong."""
    if "đ" in text.lower():
        return True
    return any(unicodedata.combining(c) for c in unicodedata.normalize("NFD", text))


def translate_one(client, cfg, pool: ModelPool, rec: dict[str, Any], retries: int = 8) -> dict[str, Any]:
    last: Exception | None = None
    for attempt in range(retries):
        model = pool.acquire()
        if model is None:
            raise RuntimeError("het han muc ngay o tat ca model")
        try:
            resp = client.models.generate_content(
                model=model,
                contents=build_user_prompt(rec),
                config=cfg,
            )
            out = parse_reply(resp.text)
            validate(out)
            if (
                attempt < 2
                and " " in out["title"]
                and not has_dau(out["title"])
                and has_dau(out["content_html"])
            ):
                raise ValueError(f"tieu de rot dau: {out['title']}")
            merged = dict(rec)
            merged.update(
                {
                    "title_en": rec.get("title"),
                    "title": out["title"].strip(),
                    "short_description": (out.get("short_description") or "").strip(),
                    "also_called_vi": out.get("also_called") or [],
                    "content_html": out["content_html"],
                    "content_text": None,  # import.py tu sinh lai tu HTML da lam sach
                    "translated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "translator_model": model,
                    "language": "vi",
                }
            )
            pool.mark_ok(model)
            return merged
        except Exception as exc:  # noqa: BLE001 - ghi lai roi thu lai
            last = exc
            # 429/RESOURCE_EXHAUSTED la chuyen thuong o Gemini khi chay nhieu
            # luong; lui dan co them nhieu ngau nhien de cac luong khong cung
            # thuc day mot luc.
            text = str(exc)
            if "RESOURCE_EXHAUSTED" in text or "429" in text:
                # Model nay can - doi sang model khac ngay thay vi nam cho.
                pool.penalise(model, exc)
                continue
            time.sleep(min(2 ** attempt, 30) + random.uniform(0, 3))
    raise RuntimeError(f"{rec.get('source_id')}: {last}")


def load_done(path: str) -> set[str]:
    done: set[str] = set()
    if not os.path.exists(path):
        return done
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                done.add(str(json.loads(line).get("source_id")))
            except json.JSONDecodeError:
                continue
    return done


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default="medlineplus.jsonl")
    ap.add_argument("--out", dest="dst", default="medlineplus.vi.jsonl")
    ap.add_argument("--model", default="", help="chi dung mot model duy nhat")
    ap.add_argument("--models", default=MODELS_DEFAULT,
                    help="danh sach 'ten:rpm:rpd' ngan cach bang dau phay")
    ap.add_argument("--list-models", action="store_true",
                    help="in ra model tai khoan dang co roi thoat")
    ap.add_argument("--limit", type=int, default=0, help="0 = dich het")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--rpm", type=float, default=5)
    ap.add_argument("--only", default="", help="loc theo source_id, ngan cach bang dau phay")
    ap.add_argument(
        "--thinking",
        type=int,
        default=0,
        help="ngan sach suy nghi cua Gemini 2.5 (token). 0 = tat cho re; "
             "-1 = de model tu quyet",
    )
    args = ap.parse_args()

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("thieu thu vien: pip install google-genai", file=sys.stderr)
        return 2

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("thieu bien moi truong GEMINI_API_KEY", file=sys.stderr)
        return 2

    if args.list_models:
        # Phai giu tham chieu toi client: models.list() la pager luoi, no
        # goi mang trong luc lap. Tao inline thi client bi thu gom va dong
        # httpx giua chung -> 'client has been closed'.
        probe = genai.Client(api_key=api_key)
        for m in probe.models.list():
            actions = list(getattr(m, "supported_actions", None) or [])
            if not actions or "generateContent" in actions:
                print(m.name)
        return 0

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    done = load_done(args.dst)

    todo: list[dict[str, Any]] = []
    with open(args.src, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            sid = str(rec.get("source_id"))
            if only and sid not in only:
                continue
            if sid in done:
                continue
            if not (rec.get("content_html") or rec.get("content_text")):
                continue
            todo.append(rec)
            if args.limit and len(todo) >= args.limit:
                break

    if args.model:
        specs = [(args.model, args.rpm, 10 ** 9)]
    else:
        specs = []
        for item in args.models.split(","):
            item = item.strip()
            if not item:
                continue
            bits = item.split(":")
            name = bits[0].strip().replace("models/", "")
            rpm = float(bits[1]) if len(bits) > 1 and bits[1] else 5.0
            rpd = int(bits[2]) if len(bits) > 2 and bits[2] else 20
            specs.append((name, rpm, rpd))
    if not specs:
        print("khong co model nao trong --models", file=sys.stderr)
        return 2

    print("model             :")
    for name, rpm, rpd in specs:
        print(f"  - {name:<28} {rpm:g}/phut, {rpd}/ngay")
    print(f"tran ngay gop lai : {sum(r for _, _, r in specs)}")
    print(f"da dich truoc do : {len(done)}")
    print(f"can dich lan nay : {len(todo)}")
    if not todo:
        return 0

    pool = ModelPool(specs)
    client = genai.Client(api_key=api_key)
    cfg = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        response_schema=RESPONSE_SCHEMA,
        max_output_tokens=16384,
        temperature=0.3,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        # Bai y te hay cham vao tu khoa nhay cam (tu tu, lam dung chat, tinh
        # duc). Day la noi dung giao duc suc khoe cua NIH, nen ha nguong chan
        # xuong con muc nguy hiem ro rang - neu khong mot phan chu de se bi
        # tra ve rong.
        safety_settings=[
            types.SafetySetting(category=c, threshold="BLOCK_ONLY_HIGH")
            for c in (
                "HARM_CATEGORY_HARASSMENT",
                "HARM_CATEGORY_HATE_SPEECH",
                "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "HARM_CATEGORY_DANGEROUS_CONTENT",
            )
        ],
    )
    if args.thinking >= 0:
        cfg.thinking_config = types.ThinkingConfig(thinking_budget=args.thinking)

    work: queue.Queue = queue.Queue()
    for rec in todo:
        work.put(rec)

    lock = threading.Lock()
    counters = {"ok": 0, "fail": 0}
    out_fh = open(args.dst, "a", encoding="utf-8")

    def worker() -> None:
        while True:
            try:
                rec = work.get_nowait()
            except queue.Empty:
                return
            try:
                merged = translate_one(client, cfg, pool, rec)
                line = json.dumps(merged, ensure_ascii=False)
                with lock:
                    out_fh.write(line + "\n")
                    out_fh.flush()
                    counters["ok"] += 1
                    n = counters["ok"] + counters["fail"]
                    print(f"[{n}/{len(todo)}] {rec.get('title')} -> {merged['title']}"
                          f"  [{merged['translator_model']}]", flush=True)
            except Exception as exc:  # noqa: BLE001
                with lock:
                    counters["fail"] += 1
                    print(f"  LOI {exc}", file=sys.stderr, flush=True)
            finally:
                work.task_done()

    threads = [threading.Thread(target=worker, daemon=True) for _ in range(max(1, args.workers))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    out_fh.close()

    print(f"\nxong: {counters['ok']} thanh cong, {counters['fail']} that bai -> {args.dst}")
    print(pool.report())
    if counters["fail"]:
        print("\nChay lai dung lenh nay de dich not phan con lai.")
    return 1 if counters["fail"] and not counters["ok"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
