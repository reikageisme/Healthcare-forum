import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDatabase, freshDatabase, json, request, seedUser } from './setup.js';
import { db } from '../src/db/index.js';
import { posts, users } from '../src/db/schema.js';

beforeAll(async () => {
  await freshDatabase();
});
afterAll(async () => {
  await closeDatabase();
});

let ip = 0;
const nextIp = () => ({ 'x-forwarded-for': `10.7.${Math.floor(ip / 250)}.${ip++ % 250}` });

async function createPost(token: string, title: string, extra: Record<string, unknown> = {}) {
  const res = await request('/posts', {
    method: 'POST',
    token,
    headers: nextIp(),
    body: json({ title, content: '<p>Nội dung bài viết đủ dài để qua kiểm tra.</p>', ...extra }),
  });
  return { status: res.status, body: await res.json() };
}

describe('tìm kiếm tiếng Việt không dấu', () => {
  it('gõ không dấu vẫn ra bài có dấu', async () => {
    const doctor = await seedUser('doctor');
    await createPost(doctor.token, 'Bệnh tiểu đường tuýp 2 ở người cao tuổi');

    const found = await (
      await request('/posts?search=tieu duong&limit=20', { headers: nextIp() })
    ).json();
    expect(found.items.map((p: { title: string }) => p.title)).toContain(
      'Bệnh tiểu đường tuýp 2 ở người cao tuổi',
    );
  });

  it('tìm được cả chữ đ, không biến mất như khi chỉ dùng NFD', async () => {
    const doctor = await seedUser('doctor');
    await createPost(doctor.token, 'Đau dạ dày và trào ngược');

    const found = await (
      await request('/posts?search=dau da day&limit=20', { headers: nextIp() })
    ).json();
    expect(found.items.map((p: { title: string }) => p.title)).toContain(
      'Đau dạ dày và trào ngược',
    );
  });

  it('sửa bài thì kho tìm kiếm cập nhật theo', async () => {
    const doctor = await seedUser('doctor');
    const created = await createPost(doctor.token, 'Tiêu đề ban đầu');

    await request(`/posts/${created.body.id}`, {
      method: 'PUT',
      token: doctor.token,
      headers: nextIp(),
      body: json({ title: 'Viêm khớp dạng thấp' }),
    });

    const found = await (
      await request('/posts?search=viem khop&limit=20', { headers: nextIp() })
    ).json();
    expect(found.items.map((p: { id: string }) => p.id)).toContain(created.body.id);
  });
});

describe('câu trả lời được chấp nhận', () => {
  it('tác giả chọn được, và câu đó lên đầu danh sách', async () => {
    const asker = await seedUser('doctor');
    const responder = await seedUser('doctor');
    const post = (await createPost(asker.token, 'Nên uống thuốc huyết áp lúc nào?', {
      post_type: 'question',
    })).body;

    const first = await (
      await request(`/posts/${post.id}/comments`, {
        method: 'POST',
        token: responder.token,
        headers: nextIp(),
        body: json({ content: 'Câu trả lời thứ nhất' }),
      })
    ).json();
    await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: responder.token,
      headers: nextIp(),
      body: json({ content: 'Câu trả lời thứ hai' }),
    });

    const accepted = await request(`/posts/${post.id}/accepted-answer`, {
      method: 'PUT',
      token: asker.token,
      headers: nextIp(),
      body: json({ comment_id: first.id }),
    });
    expect(accepted.status).toBe(200);

    const tree = await (
      await request(`/posts/${post.id}/comments`, { headers: nextIp() })
    ).json();
    expect(tree[0].id).toBe(first.id);
    expect(tree[0].is_accepted).toBe(true);
    expect(tree[1].is_accepted).toBe(false);

    const detail = await (await request(`/posts/${post.id}`, { headers: nextIp() })).json();
    expect(detail.accepted_comment_id).toBe(first.id);
  });

  it('người ngoài không chọn được', async () => {
    const asker = await seedUser('doctor');
    const stranger = await seedUser('user');
    const post = (await createPost(asker.token, 'Câu hỏi của tôi', { post_type: 'question' })).body;

    const comment = await (
      await request(`/posts/${post.id}/comments`, {
        method: 'POST',
        token: asker.token,
        headers: nextIp(),
        body: json({ content: 'Một câu trả lời' }),
      })
    ).json();

    const res = await request(`/posts/${post.id}/accepted-answer`, {
      method: 'PUT',
      token: stranger.token,
      headers: nextIp(),
      body: json({ comment_id: comment.id }),
    });
    expect(res.status).toBe(403);
  });

  it('không nhận bình luận của bài khác', async () => {
    const author = await seedUser('doctor');
    const postA = (await createPost(author.token, 'Bài A hỏi đáp', { post_type: 'question' })).body;
    const postB = (await createPost(author.token, 'Bài B hỏi đáp', { post_type: 'question' })).body;

    const commentOnB = await (
      await request(`/posts/${postB.id}/comments`, {
        method: 'POST',
        token: author.token,
        headers: nextIp(),
        body: json({ content: 'Bình luận thuộc bài B' }),
      })
    ).json();

    const res = await request(`/posts/${postA.id}/accepted-answer`, {
      method: 'PUT',
      token: author.token,
      headers: nextIp(),
      body: json({ comment_id: commentOnB.id }),
    });
    expect(res.status).toBe(404);
  });
});

describe('đăng ẩn danh', () => {
  it('giấu danh tính với người đọc, giữ nguyên với tác giả và staff', async () => {
    const author = await seedUser('doctor');
    const stranger = await seedUser('user');
    const admin = await seedUser('admin');

    const post = (
      await createPost(author.token, 'Tôi muốn hỏi kín một chuyện', { is_anonymous: true })
    ).body;
    expect(post.is_anonymous).toBe(true);

    const asStranger = await (
      await request(`/posts/${post.id}`, { token: stranger.token, headers: nextIp() })
    ).json();
    expect(asStranger.author.id).toBe('anonymous');
    expect(asStranger.author.username).toBe('an-danh');
    expect(asStranger.author.email).toBe('');

    // Nothing about the real poster travels with the response.
    const raw = JSON.stringify(asStranger);
    expect(raw).not.toContain(author.id);
    expect(raw).not.toContain(author.email);
    expect(raw).not.toContain(author.username);

    const asAuthor = await (
      await request(`/posts/${post.id}`, { token: author.token, headers: nextIp() })
    ).json();
    expect(asAuthor.author.id).toBe(author.id);

    const asAdmin = await (
      await request(`/posts/${post.id}`, { token: admin.token, headers: nextIp() })
    ).json();
    expect(asAdmin.author.id).toBe(author.id);
  });

  it('ẩn danh áp dụng cho cả bình luận', async () => {
    const author = await seedUser('doctor');
    const commenter = await seedUser('user');
    const post = (await createPost(author.token, 'Bài để bình luận ẩn danh')).body;

    await request(`/posts/${post.id}/comments`, {
      method: 'POST',
      token: commenter.token,
      headers: nextIp(),
      body: json({ content: 'Bình luận kín', is_anonymous: true }),
    });

    const tree = await (
      await request(`/posts/${post.id}/comments`, { headers: nextIp() })
    ).json();
    expect(tree[0].is_anonymous).toBe(true);
    expect(tree[0].author.id).toBe('anonymous');
    expect(JSON.stringify(tree)).not.toContain(commenter.username);
  });

  it('bài thường vẫn hiện tác giả bình thường', async () => {
    const author = await seedUser('doctor');
    const post = (await createPost(author.token, 'Bài công khai bình thường')).body;
    expect(post.is_anonymous).toBe(false);
    expect(post.author.id).toBe(author.id);
  });
});

describe('chặn spam thực phẩm chức năng', () => {
  it('đẩy bài quảng cáo vào hàng chờ dù tác giả là bác sĩ', async () => {
    const doctor = await seedUser('doctor');

    const spam = await createPost(doctor.token, 'Thuốc quý cho người tiểu đường', {
      content:
        '<p>Sản phẩm thực phẩm chức năng gia truyền, cam kết khỏi 100% sau 2 tháng. ' +
        'Giá chỉ 500k, inbox để đặt hàng ngay!</p>',
    });
    expect(spam.status).toBe(201);
    // A doctor normally auto-publishes; this one does not.
    expect(spam.body.status).toBe('pending');

    const clean = await createPost(doctor.token, 'Chế độ ăn cho người tiểu đường');
    expect(clean.body.status).toBe('approved');
  });

  it('tài khoản mới kèm link ngoài bị soi kỹ hơn', async () => {
    const rookie = await seedUser('doctor');
    const posted = await createPost(rookie.token, 'Chia sẻ nguồn tham khảo', {
      content: '<p>Mọi người xem thêm ở https://shop-thuoc-gia-re.example/sp/123 nhé</p>',
    });
    expect(posted.body.status).toBe('pending');

    const row = await db.select().from(posts).where(eq(posts.id, posted.body.id)).limit(1);
    expect(row[0]!.risk_score).toBeGreaterThanOrEqual(40);
  });

  it('link tới ảnh của chính diễn đàn không bị tính là link ngoài', async () => {
    const doctor = await seedUser('doctor');
    const posted = await createPost(doctor.token, 'Bài có ảnh nội bộ', {
      content: '<p>Ảnh minh họa: <img src="https://medicvn.com/uploads/abc.png"></p>',
    });
    expect(posted.body.status).toBe('approved');
  });

  it('hàng chờ kiểm duyệt xếp bài rủi ro cao lên trước', async () => {
    const admin = await seedUser('admin');
    const member = await seedUser('user');

    await createPost(member.token, 'Bài hỏi bình thường về giấc ngủ');
    await createPost(member.token, 'Bán thuốc gia truyền', {
      content: '<p>Thuốc gia truyền cam kết khỏi hoàn toàn, giá chỉ 300k, inbox để mua ngay.</p>',
    });

    const queue = await (
      await request('/admin/posts?status=pending&limit=50', {
        token: admin.token,
        headers: nextIp(),
      })
    ).json();
    expect(queue.items[0].title).toBe('Bán thuốc gia truyền');
  });
});

describe('xác thực giấy phép hành nghề', () => {
  it('nộp rồi admin duyệt thì tài khoản có dấu xác thực', async () => {
    const applicant = await seedUser('user');
    const admin = await seedUser('admin');

    const submitted = await request('/verifications', {
      method: 'POST',
      token: applicant.token,
      headers: nextIp(),
      body: json({
        full_name: 'Nguyễn Văn A',
        license_number: '012345/BYT-CCHN',
        specialty: 'Tim mạch',
        workplace: 'Bệnh viện Chợ Rẫy',
        document_url: '/uploads/abc123.jpg',
      }),
    });
    expect(submitted.status).toBe(201);
    const request_ = await submitted.json();
    expect(request_.status).toBe('pending');

    // No second request while one is open.
    const again = await request('/verifications', {
      method: 'POST',
      token: applicant.token,
      headers: nextIp(),
      body: json({
        full_name: 'Nguyễn Văn A',
        license_number: '012345/BYT-CCHN',
        document_url: '/uploads/abc123.jpg',
      }),
    });
    expect(again.status).toBe(400);

    const queue = await (
      await request('/admin/verifications?status=pending', {
        token: admin.token,
        headers: nextIp(),
      })
    ).json();
    expect(queue.items.some((x: { id: string }) => x.id === request_.id)).toBe(true);

    const approved = await request(`/admin/verifications/${request_.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ status: 'approved' }),
    });
    expect(approved.status).toBe(200);

    const row = await db.select().from(users).where(eq(users.id, applicant.id)).limit(1);
    expect(row[0]!.role).toBe('doctor');
    expect(row[0]!.verified_at).not.toBeNull();
    expect(row[0]!.specialty).toBe('Tim mạch');
    expect(row[0]!.workplace).toBe('Bệnh viện Chợ Rẫy');

    const me = await (
      await request('/auth/me', { token: applicant.token, headers: nextIp() })
    ).json();
    expect(me.verified_at).toBeTruthy();
    expect(me.workplace).toBe('Bệnh viện Chợ Rẫy');
  });

  it('chỉ nhận ảnh tải lên qua diễn đàn', async () => {
    const applicant = await seedUser('user');
    const res = await request('/verifications', {
      method: 'POST',
      token: applicant.token,
      headers: nextIp(),
      body: json({
        full_name: 'Trần Thị B',
        license_number: '999/BYT',
        document_url: 'https://evil.example/fake-license.jpg',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('hồ sơ công khai không lộ số giấy phép', async () => {
    const applicant = await seedUser('user');
    const admin = await seedUser('admin');

    const created = await (
      await request('/verifications', {
        method: 'POST',
        token: applicant.token,
        headers: nextIp(),
        body: json({
          full_name: 'Lê Văn C',
          license_number: 'SO-GIAY-PHEP-BI-MAT',
          specialty: 'Nhi khoa',
          document_url: '/uploads/xyz.jpg',
        }),
      })
    ).json();

    await request(`/admin/verifications/${created.id}`, {
      method: 'PUT',
      token: admin.token,
      headers: nextIp(),
      body: json({ status: 'approved' }),
    });

    const publicProfile = await request(`/verifications/users/${applicant.id}`, {
      headers: nextIp(),
    });
    const text = await publicProfile.text();
    expect(publicProfile.status).toBe(200);
    expect(text).not.toContain('SO-GIAY-PHEP-BI-MAT');
    expect(text).toContain('Nhi khoa');
  });

  it('moderator không duyệt được xác thực, chỉ admin', async () => {
    const applicant = await seedUser('user');
    const moderator = await seedUser('moderator');

    const created = await (
      await request('/verifications', {
        method: 'POST',
        token: applicant.token,
        headers: nextIp(),
        body: json({
          full_name: 'Phạm Thị D',
          license_number: '777/BYT',
          document_url: '/uploads/d.jpg',
        }),
      })
    ).json();

    const res = await request(`/admin/verifications/${created.id}`, {
      method: 'PUT',
      token: moderator.token,
      headers: nextIp(),
      body: json({ status: 'approved' }),
    });
    expect(res.status).toBe(403);
  });
});
