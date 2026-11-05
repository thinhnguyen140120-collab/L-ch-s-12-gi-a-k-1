// GỘP CƠ SỞ DỮ LIỆU TOÀN BỘ CÂU HỎI LỊCH SỬ 12 GIỮA KỲ 1 VÀ THÔNG TIN BÀI HỌC
window.LESSONS_INFO = {
    1: {
        id: 1,
        title: "Bài 1: Liên Hợp Quốc",
        shortTitle: "Bài 1: Liên Hợp Quốc",
        desc: "Bối cảnh thành lập, mục tiêu, nguyên tắc hoạt động, cơ cấu tổ chức và vai trò của Liên Hợp Quốc đối với thế giới và Việt Nam.",
        total: (window.DATA_B1 || []).length || 34
    },
    2: {
        id: 2,
        title: "Bài 2: Trật Tự Thế Giới Trong Chiến Tranh Lạnh",
        shortTitle: "Bài 2: Trật Tự Hai Cực I-an-ta",
        desc: "Hội nghị I-an-ta (1945), sự hình thành trật tự hai cực I-an-ta, sự đối đầu Đông - Tây và quá trình suy yếu, sụp đổ.",
        total: (window.DATA_B2 || []).length || 31
    },
    3: {
        id: 3,
        title: "Bài 3: Trật Tự Thế Giới Sau Chiến Tranh Lạnh",
        shortTitle: "Bài 3: Trật Tự Đa Cực & Toàn Cầu Hóa",
        desc: "Xu thế đa cực trong quan hệ quốc tế, chiến lược lấy kinh tế làm trọng tâm và tác động của xu thế Toàn cầu hóa.",
        total: (window.DATA_B3 || []).length || 24
    },
    4: {
        id: 4,
        title: "Bài 4: Sự Ra Đời Và Phát Triển Của ASEAN",
        shortTitle: "Bài 4: Sự Ra Đời & Phát Triển ASEAN",
        desc: "Hoàn cảnh thành lập (1967), mục tiêu Tuyên bố ASEAN, các giai đoạn phát triển từ ASEAN 5 đến ASEAN 10 và vai trò đối với khu vực.",
        total: (window.DATA_B4 || []).length || 26
    },
    5: {
        id: 5,
        title: "Bài 5: Cộng Đồng ASEAN Từ Ý Tưởng Đến Hiện Thực",
        shortTitle: "Bài 5: Cộng Đồng ASEAN (3 Trụ Cột)",
        desc: "Quá trình hình thành, 3 trụ cột (APSC, AEC, ASCC), Hiến chương ASEAN, triển vọng và thách thức đối với khu vực và Việt Nam.",
        total: (window.DATA_B5 || []).length || 28
    }
};

window.RAW_DATABASE = [
    ...(window.DATA_B1 || []),
    ...(window.DATA_B2 || []),
    ...(window.DATA_B3 || []),
    ...(window.DATA_B4 || []),
    ...(window.DATA_B5 || [])
];

console.log("Đã tải thành công Cơ sở dữ liệu Lịch Sử 12 GK1:", window.RAW_DATABASE.length, "câu hỏi.");
