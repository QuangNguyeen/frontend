## 1) MVP Version (tối thiểu nhưng chạy được)

Mục tiêu của MVP là làm được “xương sống” của sản phẩm: nhập link YouTube → lấy transcript → tạo bài Dictation nghe-chép → chấm điểm cơ bản → lưu lịch sử. MVP cần ưu tiên luồng học hoàn chỉnh end-to-end hơn là nhiều tính năng rời rạc.[^1]

Phạm vi đề xuất:

- Đăng ký/đăng nhập cơ bản (email) và hồ sơ người dùng tối giản.[^1]
- Trích xuất phụ đề từ YouTube: nhập URL, lấy transcript dạng mảng (text, start, duration), có cache đơn giản; xử lý lỗi “video không có phụ đề/region lock/API limit” ở mức thông báo + retry/queue nhẹ.[^1]
- Dictation cơ bản: phát theo câu (dựa theo timestamp), ô nhập câu trả lời, chấm điểm tự động mức ký tự/từ (ví dụ dùng Levenshtein distance), hiển thị từ sai/thiếu, tính điểm tổng.[^1]
- Lưu tiến độ: lưu mỗi lần làm dictation (videoId, completedAt, score, mode), trang “Lịch sử/Progress” tối giản.[^1]

Sản phẩm/deliverables bắt buộc (để đủ chuẩn đồ án):

- Thiết kế CSDL tối thiểu: User, Video/Transcript cache, DictationAttempt.[^1]
- Thiết kế API + UI cho 2 use-case chính: “Lấy transcript” và “Làm bài dictation”.[^1]
- Báo cáo có phần đánh giá thuật toán chấm điểm và test tối thiểu (unit test cho scoring, test lỗi YouTube transcript).[^1]


## 2) Normal Version (đủ “đồ án tốt nghiệp” rõ ràng)

Normal version mở rộng MVP thành một hệ thống học tập có bài tập đa dạng và lộ trình, nhưng vẫn kiểm soát độ khó (không dồn vào AI/audio phức tạp). Trọng tâm là: Dictation tốt hơn + hệ học từ vựng + bài tập ngữ pháp đọc hiểu + thư viện nội dung theo level + dashboard tiến độ.[^1]

Phạm vi đề xuất:

- Dictation nâng cấp: nhiều mode (Beginner/Intermediate/Advanced), hỗ trợ bỏ qua dấu câu khi chấm, chấp nhận biến thể (I’m/I am), tùy chọn hiển thị romaji/hiragana cho Nhật (nếu triển khai).[^1]
- Flashcard + SRS: tạo deck, import CSV/Excel, tự tạo flashcard từ từ mới trong Dictation; thuật toán ôn tập theo đánh giá người học (Quên/Khó/Tốt/Rất tốt) với lịch 1 phút–10 phút–1 ngày–3 ngày–7 ngày….[^1]
- Fill in the Blank: tạo bài điền từ theo nhiều mức gợi ý (có đáp án chọn/cho nghĩa/không gợi ý) để luyện từ vựng-ngữ pháp.[^1]
- Thư viện video theo level: gán level JLPT N5–N3 hoặc CEFR A1–B2, lọc/tìm kiếm và gợi ý học theo level.[^1]
- Dashboard tiến độ: streak, thời gian học hôm nay, hoạt động 7 ngày, thống kê lỗi hay gặp (mức cơ bản).[^1]
- Nếu chọn nhánh “Nhật ngữ”: thêm 1–2 tính năng đặc thù như Furigana toggle và/hoặc Kanji lookup (click Kanji xem On/Kun, nghĩa, JLPT…).[^1]

Sản phẩm/deliverables nên có:

- Thiết kế kiến trúc rõ (Frontend/Backend/DB, cache transcript, job queue nhẹ nếu cần) gắn với các ràng buộc “bản quyền dữ liệu YouTube”, “không có phụ đề”, “API limit”.[^1]
- Bộ dữ liệu nội bộ (curated) tối thiểu: một số video/lesson đã biên soạn lại để tránh phụ thuộc hoàn toàn vào YouTube khi demo.[^1]
- Kiểm thử: test SRS scheduling, test import deck, test truy vấn thống kê tiến độ.[^1]


## 3) Advance Version (nâng cao, có “điểm nghiên cứu/AI”)

Advance version phù hợp nếu sinh viên mạnh và muốn “đề tài có chiều sâu”: thêm các bài tập/hệ thống phân tích nâng cao hoặc phần xử lý âm thanh/AI (nhưng phải quản rủi ro). Nên chọn 1 hướng nâng cao chính để làm sâu, tránh ôm quá nhiều.[^1]

Hướng A (Nâng cao học tập, ít AI):

- Listening Comprehension Quiz sau video; Sentence Reordering; thống kê chi tiết “từ hay sai”/nhóm lỗi theo người học.[^1]
- Hệ gợi ý nội dung: đề xuất video theo level + theo lỗi thường gặp (rule-based trước).[^1]
- Authoring tool: công cụ cho admin/teacher tạo bài từ transcript (chọn câu, tạo blank, gán từ vựng mục tiêu).[^1]

Hướng B (Có AI/audio – khó hơn, nhưng nổi bật):

- Shadowing: ghi âm người học, so sánh phát âm (cần pipeline xử lý audio, đánh giá tương đồng; file ghi chú đây là phần khó).[^1]
- Chấm dictation “thông minh”: chuẩn hóa từ (stemming/lemmatization tiếng Anh), fuzzy matching theo từ đồng nghĩa (cẩn thận sai lệch), phân tích lỗi theo loại (thiếu từ, sai trật tự…) dựa trên alignment.[^1]

Deliverables nâng cao:

- Báo cáo đánh giá: thí nghiệm A/B hoặc benchmark (ví dụ so sánh 2 cách chấm điểm, hoặc đo tác động SRS lên retention bằng log).[^1]
- Quan tâm NFR: hiệu năng (cache transcript), bảo mật (JWT/refresh, rate-limit), logging/monitoring, khả năng mở rộng.[^1]


## Nội dung cần đạt (chuẩn đầu ra đồ án)

Các nội dung nên yêu cầu sinh viên chứng minh được (theo đúng ý tưởng trong file):[^1]

- Bài toán \& mục tiêu rõ: tập trung luyện “nghe-chép (dictation)” bằng video YouTube có phụ đề; không đi theo hướng TOEIC/IELTS tổng hợp.[^1]
- Chức năng lõi chạy ổn: trích xuất transcript, dictation theo câu, chấm điểm tự động, lưu tiến độ người học.[^1]
- Thiết kế dữ liệu/kiến trúc hợp lý: cache transcript, xử lý các ca lỗi video không có phụ đề/region/API limit; có dữ liệu demo nội bộ để bảo đảm demo thành công.[^1]
- Có thuật toán/logic đủ “kỹ thuật”: scoring bằng Levenshtein/word-diff, SRS scheduling, thống kê tiến độ… (tùy version).[^1]
- Có kiểm thử và đánh giá: test chức năng chính + đánh giá chất lượng scoring/SRS hoặc trải nghiệm người dùng qua số liệu log cơ bản.[^1]


## Outline cơ bản đồ án tốt nghiệp (đề cương báo cáo)

1. Giới thiệu đề tài: bối cảnh học nghe, vấn đề “nghe nhưng không viết lại được”, mục tiêu hệ thống dictation từ video có phụ đề.[^1]
2. Khảo sát \& đối sánh: tham khảo các website/ý tưởng tương tự (dictation UI, tracking, hiển thị video…) và rút ra yêu cầu cho hệ thống.[^1]
3. Phân tích yêu cầu: use-case, yêu cầu chức năng (YouTube transcript, dictation, SRS/blank/stroke…), yêu cầu phi chức năng (hiệu năng, lỗi API, bản quyền dữ liệu).[^1]
4. Thiết kế hệ thống: kiến trúc tổng quan, thiết kế CSDL, thiết kế API, thiết kế luồng UI/UX cho bài học và dashboard; mô tả cache/queue nếu có.[^1]
5. Cài đặt \& kết quả: mô tả các module đã làm theo version (MVP/Normal/Advance), minh họa màn hình chính, mô tả thuật toán chấm điểm và/hoặc SRS.[^1]
6. Kiểm thử \& đánh giá: test case chính, kết quả đo (độ đúng scoring, thời gian phản hồi, tỉ lệ lỗi transcript…), nhận xét ưu/nhược.[^1]
7. Kết luận \& hướng phát triển: đề xuất mở rộng (shadowing/quiz/reordering/thống kê sâu) theo phần “tích hợp phương pháp học” trong ý tưởng.[^1]


