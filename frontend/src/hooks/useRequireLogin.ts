import { useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { IS_FORUM, loginHref } from '../lib/siteLinks';

/**
 * Một chỗ duy nhất để đưa người chưa đăng nhập sang trang đăng nhập.
 *
 * Trước đây bảy component tự gọi navigate('/login', { state: { from } }).
 * Ở diễn đàn cách đó hỏng hai lần: /login của forums.medicvn.com chỉ là một
 * bảng chuyển hướng, nên `state.from` rơi mất và người dùng quay về trang chủ
 * trang tin thay vì cái thớt họ đang đọc; và vì là push, bấm Back đưa họ về
 * đúng trang vừa đá họ đi, để nó đá tiếp — nút Back coi như hỏng.
 *
 * `replace: true` dành cho lối chặn tự động trong useEffect: thứ người dùng
 * không hề bấm thì không đáng chiếm một ô lịch sử. Người dùng tự bấm "Trả
 * lời" hay "Lưu bài" thì dùng push, để Back đưa họ về đúng chỗ vừa đứng.
 */
export function useRequireLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  // Giữ vị trí hiện tại trong ref: hàm trả về nhờ thế mà không đổi danh tính
  // sau mỗi lần điều hướng. Nó nằm trong dependency của vài useCallback/
  // useEffect gọi API — đổi danh tính mỗi lần render là gọi lại API mỗi lần.
  const locationRef = useRef<Location>(location);
  locationRef.current = location;

  return useCallback(
    (options?: { replace?: boolean }) => {
      const replace = options?.replace ?? false;
      if (IS_FORUM) {
        // Rời tên miền: react-router không làm được, và cũng không nên —
        // loginHref() đã kèm ?next=<url hiện tại> để quay lại sau khi xong.
        if (replace) window.location.replace(loginHref());
        else window.location.assign(loginHref());
        return;
      }
      navigate('/login', { state: { from: locationRef.current }, replace });
    },
    [navigate],
  );
}

/** `true` khi đã biết chắc người xem chưa đăng nhập (không phải "đang chờ biết"). */
export function useIsGuest(): boolean {
  return useAuthStore((s) => s.authReady && !s.isAuthenticated);
}

export default useRequireLogin;
