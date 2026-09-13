# Nhập dữ liệu MedlinePlus vào medicvn.com

Ba bước: **tải XML → dịch → đổ vào CSDL**.

```
mplus_topics_YYYY-MM-DD.xml   (NLM, public domain)
        │  parse_mlp.py
        ▼
medlineplus.jsonl             1.017 chủ đề tiếng Anh
        │  translate.py       (Google Gemini API)
        ▼
medlineplus.vi.jsonl          bản dịch tiếng Việt
        │  import.py
        ▼
posts (surface='portal', status='pending')
```

## Vì sao nguồn này an toàn còn Long Châu thì không

Bản tóm tắt chủ đề sức khỏe của MedlinePlus do NIH/NLM soạn và **thuộc phạm vi
công cộng** — dùng lại được, kể cả cho mục đích thương mại. Bản dịch tiếng Việt
là tác phẩm phái sinh do bạn tạo ra: không trùng với bất kỳ trang tiếng Việt nào
đang có (Google không coi là nội dung sao chép), và bạn giữ quyền đối với nó.
Nguồn NIH/CDC còn trích dẫn được, giúp E-E-A-T của một trang y tế.

**Giới hạn bản quyền — bắt buộc tuân thủ:** chỉ dùng phần *health topic summary*
trong file XML. **Medical Encyclopedia (A.D.A.M.)** và **Drug Information (ASHP)**
trên medlineplus.gov là của bên thứ ba, KHÔNG thuộc public domain.

## 1. Tải và phân tích XML

```bash
cd /srv/ingest/medlineplus
curl -O https://medlineplus.gov/xml/mplus_topics_$(date +%F).xml
python3 parse_mlp.py mplus_topics_*.xml medlineplus.jsonl
```

## 2. Dịch (Google Gemini)

```bash
pip install google-genai
export GEMINI_API_KEY=AIza...      # lấy ở https://aistudio.google.com/apikey

# dịch thử 5 bài để xem giọng văn
python3 translate.py --in medlineplus.jsonl --out medlineplus.vi.jsonl --limit 5
head -1 medlineplus.vi.jsonl | python3 -m json.tool

# chạy hết (khoảng 1.017 bài, 4 luồng)
python3 translate.py --in medlineplus.jsonl --out medlineplus.vi.jsonl --workers 4
```

Chạy lại được: bài nào đã có trong file `--out` (theo `source_id`) thì bỏ qua,
nên đứt mạng giữa chừng chỉ cần chạy lại đúng lệnh cũ.

| Cờ | Ý nghĩa |
|---|---|
| `--limit N` | chỉ dịch N bài chưa có |
| `--only 6308,4432` | chỉ dịch đúng các `source_id` này |
| `--model` | mặc định `gemini-2.5-flash`; đổi `gemini-2.5-pro` nếu bản dịch còn cứng |
| `--workers` | số luồng song song, mặc định 4 |
| `--thinking N` | ngân sách suy nghĩ (token). `0` = tắt cho rẻ (mặc định), `-1` = để model tự quyết |

Ba chi tiết đã xử lý sẵn cho Gemini:

- **`response_schema`** — Gemini trả về đúng khuôn JSON, không phải gỡ ``` như
  khi dùng prompt suông.
- **Ngưỡng an toàn hạ xuống `BLOCK_ONLY_HIGH`** — bài y tế hay chạm vào từ khoá
  nhạy cảm (tự tử, lạm dụng chất, sức khỏe tình dục). Đây là nội dung giáo dục
  sức khỏe của NIH, để nguyên mặc định thì một phần chủ đề sẽ trả về rỗng.
- **Lùi dần có nhiễu ngẫu nhiên khi gặp 429** — hạn mức Gemini siết theo phút,
  chạy 4 luồng rất dễ chạm. Nếu vẫn lỗi nhiều thì hạ `--workers 2`.

## 3. Đổ vào CSDL

```bash
pip install "psycopg[binary]"
export DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/medicvn

# xem trước, không ghi gì
python3 import.py --in medlineplus.vi.jsonl --author admin@medicvn.com --dry-run

# đổ thật (mặc định vào hàng chờ duyệt)
python3 import.py --in medlineplus.vi.jsonl --author admin@medicvn.com
```

**Sao lưu CSDL trước khi chạy lần đầu.**

Script làm gì:

- `surface = 'portal'`, `post_type = 'article'`, `status = 'pending'`
  (đổi bằng `--status approved` nếu muốn đăng thẳng).
- Tài khoản `--author` phải có vai trò `admin`, `moderator` hoặc `doctor` —
  đúng điều kiện `canPublishToPortal()` của backend.
- Chuyên mục: tạo cây con dưới **Cẩm nang sức khỏe** theo nhóm chủ đề của
  MedlinePlus (Đái tháo đường, Tim mạch - Máu, Thần kinh - Não bộ...).
  Nhóm nào chưa có tên tiếng Việt thì giữ tên gốc và script in ra cuối để bạn
  đổi tên trong trang quản trị.
- Slug sinh bằng đúng thuật toán `slugify()` của backend (bỏ dấu, `đ → d`),
  trùng thì thêm hậu tố `-2`, `-3`.
- `search_text` sinh bằng đúng `toSearchText()` của backend.
- HTML được lọc theo đúng danh sách thẻ của `sanitize.ts` (script ghi thẳng
  vào bảng `posts`, không đi qua API nên phải tự làm sạch).
- Cuối mỗi bài tự gắn khối ghi nguồn kèm link gốc và câu miễn trừ y khoa.

### Chạy lại nhiều lần

Bảng `import_sources` (script tự tạo nếu chưa có) nhớ từng bài theo
`(source, source_id)` cùng `content_hash`:

- hash không đổi → bỏ qua
- hash đổi (bạn dịch lại) → **cập nhật** bài cũ, không tạo bài trùng
- bài chưa có → thêm mới

## Kiểm tra sau khi nhập

```sql
SELECT c.name, count(*) FROM posts p
  JOIN categories c ON c.id = p.category_id
 WHERE p.surface = 'portal' GROUP BY 1 ORDER BY 2 DESC;

SELECT count(*) FROM import_sources WHERE source = 'medlineplus';
```
