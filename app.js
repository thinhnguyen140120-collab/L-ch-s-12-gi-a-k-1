// TOÀN BỘ LOGIC ỨNG DỤNG ÔN THI LỊCH SỬ 12 GIỮA KỲ 1 (CHUẨN GDPT 2018)
class HistoryQuizApp {
    constructor() {
        this.db = window.RAW_DATABASE || [];
        this.lessons = window.LESSONS_INFO || {};

        // Trạng thái ứng dụng
        this.currentMode = 'home'; // 'home' | 'practice' | 'exam' | 'mistakes' | 'bookmarks' | 'stats'
        this.currentFilter = 'all'; // 'all' | 1 | 2 | 3 | 4 | 5
        this.activeQuestions = [];
        this.searchKeyword = '';
        this.typeFilter = 'all'; // 'all' | 'mcq' | 'tf'

        // Trạng thái thi thử (Exam Mode)
        this.examState = {
            isActive: false,
            isSubmitted: false,
            questions: [],
            userAnswers: {},
            timeLeft: 45 * 60, // 45 phút
            timerInterval: null,
            score: null,
            partScores: { p1: 0, p2: 0 }
        };

        // Dữ liệu lưu trữ LocalStorage
        this.userAnswers = JSON.parse(localStorage.getItem('hist12_answers_v4')) || {};
        this.mistakes = JSON.parse(localStorage.getItem('hist12_mistakes_v4')) || [];
        this.bookmarks = JSON.parse(localStorage.getItem('hist12_bookmarks_v4')) || [];
        this.examHistory = JSON.parse(localStorage.getItem('hist12_exam_history_v4')) || [];

        // Làm sạch danh sách câu sai (loại bỏ câu đã làm đúng từ trước)
        this.cleanMistakes();

        this.init();
    }

    init() {
        this.render();
    }

    saveState() {
        localStorage.setItem('hist12_answers_v4', JSON.stringify(this.userAnswers));
        localStorage.setItem('hist12_mistakes_v4', JSON.stringify(this.mistakes));
        localStorage.setItem('hist12_bookmarks_v4', JSON.stringify(this.bookmarks));
        localStorage.setItem('hist12_exam_history_v4', JSON.stringify(this.examHistory));
    }

    shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // =========================================================================
    // HỆ THỐNG KIỂM TRA TRẠNG THÁI CÂU HỎI & QUẢN LÝ SỔ TAY CÂU SAI
    // =========================================================================
    isQuestionCorrect(q) {
        if (!q) return false;
        const uAns = this.userAnswers[q.id];
        if (!uAns) return false;

        if (q.type === 'mcq') {
            return uAns.selected !== undefined && parseInt(uAns.selected) === parseInt(q.answer);
        }
        if (q.type === 'tf') {
            if (!q.items || q.items.length === 0) return false;
            return q.items.every(item => uAns[item.label] !== undefined && uAns[item.label] === item.answer);
        }
        return false;
    }

    isQuestionIncorrect(q) {
        if (!q) return false;
        const uAns = this.userAnswers[q.id];

        if (q.type === 'mcq') {
            if (uAns && uAns.selected !== undefined && uAns.selected !== null) {
                return parseInt(uAns.selected) !== parseInt(q.answer);
            }
            return this.mistakes.includes(q.id);
        }

        if (q.type === 'tf') {
            if (uAns && Object.keys(uAns).length > 0) {
                let hasWrongItem = false;
                let answeredAll = true;
                q.items.forEach(item => {
                    if (uAns[item.label] !== undefined) {
                        if (uAns[item.label] !== item.answer) {
                            hasWrongItem = true;
                        }
                    } else {
                        answeredAll = false;
                    }
                });
                if (hasWrongItem) return true;
                if (answeredAll) return false;
            }
            return this.mistakes.includes(q.id);
        }

        return false;
    }

    cleanMistakes() {
        const prevCount = this.mistakes.length;
        this.mistakes = this.mistakes.filter(id => {
            const q = this.db.find(item => item.id === id);
            if (!q) return false;
            if (this.isQuestionCorrect(q)) return false;
            return this.isQuestionIncorrect(q);
        });
        if (this.mistakes.length !== prevCount) {
            this.saveState();
        }
    }

    toggleBookmark(qId) {
        const index = this.bookmarks.indexOf(qId);
        if (index > -1) {
            this.bookmarks.splice(index, 1);
        } else {
            this.bookmarks.push(qId);
        }
        this.saveState();
        if (this.currentMode === 'bookmarks') {
            this.activeQuestions = this.db.filter(q => this.bookmarks.includes(q.id));
            this.render();
        } else {
            this.updateQuestionCardUI(qId);
        }
    }

    // Điều hướng giữa các màn hình
    navigateTo(mode, filter = 'all') {
        if (this.examState.isActive && !this.examState.isSubmitted && mode !== 'exam') {
            if (!confirm("Bạn đang trong bài thi thử. Rời đi sẽ hủy kết quả bài thi hiện tại. Bạn có chắc chắn muốn thoát?")) {
                return;
            }
            this.exitExam();
        }

        this.currentMode = mode;
        this.currentFilter = filter;
        this.searchKeyword = '';

        if (mode === 'practice') {
            if (filter === 'all') {
                this.activeQuestions = [...this.db];
            } else {
                this.activeQuestions = this.db.filter(q => q.lesson === parseInt(filter));
            }
        } else if (mode === 'mistakes') {
            this.cleanMistakes();
            this.activeQuestions = this.db.filter(q => this.mistakes.includes(q.id) && !this.isQuestionCorrect(q));
        } else if (mode === 'bookmarks') {
            this.activeQuestions = this.db.filter(q => this.bookmarks.includes(q.id));
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.render();
    }

    handleSearch(keyword) {
        this.searchKeyword = keyword.toLowerCase().trim();
        this.applyFilters();
    }

    handleTypeFilter(type) {
        this.typeFilter = type;
        this.applyFilters();
    }

    applyFilters() {
        let baseList = [];
        if (this.currentMode === 'practice') {
            baseList = this.currentFilter === 'all' 
                ? [...this.db] 
                : this.db.filter(q => q.lesson === parseInt(this.currentFilter));
        } else if (this.currentMode === 'mistakes') {
            this.cleanMistakes();
            baseList = this.db.filter(q => this.mistakes.includes(q.id) && !this.isQuestionCorrect(q));
        } else if (this.currentMode === 'bookmarks') {
            baseList = this.db.filter(q => this.bookmarks.includes(q.id));
        }

        this.activeQuestions = baseList.filter(q => {
            const matchType = this.typeFilter === 'all' || q.type === this.typeFilter;
            const matchText = !this.searchKeyword || 
                (q.question && q.question.toLowerCase().includes(this.searchKeyword)) ||
                (q.context && q.context.toLowerCase().includes(this.searchKeyword)) ||
                (q.options && q.options.some(opt => opt.toLowerCase().includes(this.searchKeyword)));
            return matchType && matchText;
        });

        const listEl = document.getElementById('questions-list');
        if (listEl) {
            listEl.innerHTML = this.activeQuestions.length > 0 
                ? this.activeQuestions.map((q, idx) => this.generateQuestionCardHTML(q, idx + 1)).join('')
                : `<div class="bg-white rounded-xl p-8 text-center text-gray-500 border border-dashed border-gray-300">Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.</div>`;
            const countEl = document.getElementById('filtered-count');
            if (countEl) countEl.innerText = this.activeQuestions.length;
        }
    }

    // Ghi nhận đáp án MCQ trong Luyện tập
    setMCQAnswer(qId, optionIdx) {
        if (!this.userAnswers[qId]) {
            this.userAnswers[qId] = {};
        }
        this.userAnswers[qId].selected = optionIdx;

        const q = this.db.find(item => item.id === qId);
        if (q) {
            const isCorrect = parseInt(optionIdx) === parseInt(q.answer);
            if (isCorrect) {
                this.mistakes = this.mistakes.filter(id => id !== qId);
            } else if (!this.mistakes.includes(qId)) {
                this.mistakes.push(qId);
            }
        }

        this.saveState();

        if (this.currentMode === 'mistakes') {
            this.updateQuestionCardUI(qId);
            const countEl = document.getElementById('filtered-count');
            if (countEl) countEl.innerText = this.mistakes.length;
        } else {
            this.updateQuestionCardUI(qId);
        }
    }

    // Ghi nhận đáp án Đúng / Sai trong Luyện tập
    setTFAnswer(qId, itemLabel, val) {
        if (!this.userAnswers[qId]) {
            this.userAnswers[qId] = {};
        }
        this.userAnswers[qId][itemLabel] = val;

        const q = this.db.find(item => item.id === qId);
        if (q) {
            if (this.isQuestionCorrect(q)) {
                this.mistakes = this.mistakes.filter(id => id !== qId);
            } else if (this.isQuestionIncorrect(q)) {
                if (!this.mistakes.includes(qId)) this.mistakes.push(qId);
            }
        }

        this.saveState();
        this.updateQuestionCardUI(qId);
        if (this.currentMode === 'mistakes') {
            const countEl = document.getElementById('filtered-count');
            if (countEl) countEl.innerText = this.mistakes.length;
        }
    }

    removeMistake(qId) {
        this.mistakes = this.mistakes.filter(id => id !== qId);
        this.saveState();
        this.cleanMistakes();
        this.activeQuestions = this.db.filter(q => this.mistakes.includes(q.id) && !this.isQuestionCorrect(q));
        this.render();
    }

    // =========================================================================
    // KHỞI TẠO BÀI THI THỬ GIỮA KỲ 1 (CHUẨN CẤU TRÚC BỘ GD&ĐT 2018 MÔN LỊCH SỬ)
    // Phần I: 24 câu MCQ (mỗi câu 0.25đ = 6.0đ)
    // Phần II: 4 câu Đúng/Sai (mỗi câu 4 ý, tối đa 1.0đ = 4.0đ)
    // Tổng cộng: 28 câu = 10.0 điểm, thời gian làm bài 45 phút
    // =========================================================================
    startExam() {
        const allMCQs = this.shuffleArray(this.db.filter(q => q.type === 'mcq'));
        const allTFs = this.shuffleArray(this.db.filter(q => q.type === 'tf'));

        const examMCQs = allMCQs.slice(0, 24);
        const examTFs = allTFs.slice(0, 4);

        // Tạo mảng câu hỏi có examIndex cố định từ 0 đến 27
        const examQuestions = [
            ...examMCQs.map((q, idx) => ({ ...q, examIndex: idx, examPart: 1, indexInPart: idx + 1 })),
            ...examTFs.map((q, idx) => ({ ...q, examIndex: 24 + idx, examPart: 2, indexInPart: idx + 1 }))
        ];

        const answerSlots = {};
        examQuestions.forEach(q => {
            const slot = {
                examIndex: q.examIndex,
                qId: q.id,
                selected: null,
                tf: {}
            };
            answerSlots[q.examIndex] = slot;
            answerSlots[q.id] = slot;
        });

        this.examState = {
            isActive: true,
            isSubmitted: false,
            questions: examQuestions,
            userAnswers: answerSlots,
            timeLeft: 45 * 60,
            timerInterval: null,
            score: null,
            partScores: { p1: 0, p2: 0 }
        };

        this.currentMode = 'exam';
        this.render();

        if (this.examState.timerInterval) clearInterval(this.examState.timerInterval);
        this.examState.timerInterval = setInterval(() => {
            if (this.examState.timeLeft > 0) {
                this.examState.timeLeft--;
                this.updateExamTimerDisplay();
            } else {
                clearInterval(this.examState.timerInterval);
                alert("Đã hết thời gian làm bài 45 phút! Hệ thống sẽ tự động nộp bài.");
                this.submitExam();
            }
        }, 1000);
    }

    updateExamTimerDisplay() {
        const timerEl = document.getElementById('exam-timer');
        if (!timerEl) return;
        const mins = Math.floor(this.examState.timeLeft / 60);
        const secs = this.examState.timeLeft % 60;
        timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (this.examState.timeLeft < 300) {
            timerEl.classList.add('text-red-600', 'animate-pulse');
        }
    }

    // Gán đáp án MCQ trong đề thi gắn chặt theo examIndex
    setExamMCQAnswer(examIndex, optionIdx) {
        if (this.examState.isSubmitted) return;
        const slot = this.examState.userAnswers[examIndex];
        if (!slot) return;

        slot.selected = optionIdx;

        // Cập nhật card câu hỏi
        const cardEl = document.getElementById(`exam-card-${examIndex}`);
        if (cardEl) {
            const buttons = cardEl.querySelectorAll('.mcq-exam-btn');
            buttons.forEach((btn, idx) => {
                const badge = btn.querySelector('.mcq-badge');
                if (idx === optionIdx) {
                    btn.className = "mcq-exam-btn w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 text-sm transition-all border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-500 cursor-pointer";
                    if (badge) badge.className = "mcq-badge w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-xs bg-indigo-600 text-white";
                } else {
                    btn.className = "mcq-exam-btn w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 text-sm transition-all border-gray-200 hover:bg-indigo-50/50 text-gray-800 cursor-pointer";
                    if (badge) badge.className = "mcq-badge w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-xs bg-gray-100 text-gray-700";
                }
            });
        }

        // Cập nhật nút số trên Question Palette
        this.updatePaletteButton(examIndex);
    }

    // Gán đáp án Đúng / Sai trong đề thi gắn chặt theo examIndex
    setExamTFAnswer(examIndex, itemLabel, val) {
        if (this.examState.isSubmitted) return;
        const slot = this.examState.userAnswers[examIndex];
        if (!slot) return;

        if (!slot.tf) slot.tf = {};
        slot.tf[itemLabel] = val;
        slot[itemLabel] = val;

        const cardEl = document.getElementById(`exam-card-${examIndex}`);
        if (cardEl) {
            const rowEl = cardEl.querySelector(`.tf-row-${itemLabel}`);
            if (rowEl) {
                const btnTrue = rowEl.querySelector('.tf-btn-true');
                const btnFalse = rowEl.querySelector('.tf-btn-false');

                if (btnTrue && btnFalse) {
                    if (val === true) {
                        btnTrue.className = "tf-btn-true px-3.5 py-1.5 rounded-lg font-bold text-xs bg-purple-700 text-white shadow-sm transition-colors";
                        btnFalse.className = "tf-btn-false px-3.5 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors";
                    } else if (val === false) {
                        btnTrue.className = "tf-btn-true px-3.5 py-1.5 rounded-lg font-bold text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors";
                        btnFalse.className = "tf-btn-false px-3.5 py-1.5 rounded-lg font-bold text-xs bg-purple-700 text-white shadow-sm transition-colors";
                    }
                }
            }
        }

        this.updatePaletteButton(examIndex);
    }

    updatePaletteButton(examIndex) {
        const btn = document.getElementById(`palette-btn-${examIndex}`);
        if (!btn) return;
        const slot = this.examState.userAnswers[examIndex];
        const q = this.examState.questions[examIndex];

        let hasAnswered = false;
        if (q.examPart === 1) {
            hasAnswered = slot.selected !== null && slot.selected !== undefined;
        } else if (q.examPart === 2) {
            hasAnswered = slot.tf && Object.keys(slot.tf).length === q.items.length;
        }

        if (hasAnswered) {
            btn.className = "w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all bg-indigo-600 text-white shadow-sm";
        } else {
            btn.className = "w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200";
        }
    }

    // =========================================================================
    // HÀM CHẤM ĐIỂM THI THỬ & ĐỐI CHIẾU KẾT QUẢ ĐÁP ÁN CHUẨN XÁC TUYỆT ĐỐI
    // =========================================================================
    submitExam() {
        if (this.examState.isSubmitted) return;

        // Kiểm tra xem còn câu nào chưa làm
        let unansweredCount = 0;
        this.examState.questions.forEach(q => {
            const slot = this.examState.userAnswers[q.examIndex] || {};
            if (q.examPart === 1) {
                if (slot.selected === null || slot.selected === undefined) unansweredCount++;
            } else if (q.examPart === 2) {
                const answeredItems = slot.tf ? Object.keys(slot.tf).length : 0;
                if (answeredItems < q.items.length) unansweredCount++;
            }
        });

        if (this.examState.timeLeft > 0 && unansweredCount > 0) {
            if (!confirm(`Bạn còn ${unansweredCount} câu hỏi chưa hoàn thành. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?`)) {
                return;
            }
        }

        if (this.examState.timerInterval) clearInterval(this.examState.timerInterval);

        let p1Score = 0; // Tối đa 6.0 điểm
        let p2Score = 0; // Tối đa 4.0 điểm

        for (let i = 0; i < this.examState.questions.length; i++) {
            const q = this.examState.questions[i];
            const uAns = this.examState.userAnswers[q.examIndex] || {};
            const originalQ = this.db.find(item => item.id === q.id) || q;

            // PHẦN I: 24 câu MCQ (0.25đ / câu)
            if (q.examPart === 1) {
                const hasSelected = uAns.selected !== null && uAns.selected !== undefined;
                const isCorrect = hasSelected && parseInt(uAns.selected) === parseInt(originalQ.answer);

                if (isCorrect) {
                    p1Score += 0.25;
                    this.mistakes = this.mistakes.filter(id => id !== q.id);
                } else {
                    if (!this.mistakes.includes(q.id)) {
                        this.mistakes.push(q.id);
                    }
                }
            }
            // PHẦN II: 4 câu Đúng / Sai (Quy chế Bộ GD: 1 ý: 0.1đ; 2 ý: 0.25đ; 3 ý: 0.5đ; 4 ý: 1.0đ)
            else if (q.examPart === 2) {
                let correctCount = 0;
                originalQ.items.forEach(item => {
                    const userVal = uAns.tf ? uAns.tf[item.label] : uAns[item.label];
                    if (userVal !== undefined && userVal !== null && Boolean(userVal) === Boolean(item.answer)) {
                        correctCount++;
                    }
                });

                if (correctCount === 1) p2Score += 0.1;
                else if (correctCount === 2) p2Score += 0.25;
                else if (correctCount === 3) p2Score += 0.5;
                else if (correctCount === 4) p2Score += 1.0;

                if (correctCount === 4) {
                    this.mistakes = this.mistakes.filter(id => id !== q.id);
                } else if (!this.mistakes.includes(q.id)) {
                    this.mistakes.push(q.id);
                }
            }
        }

        const totalScore = Math.round((p1Score + p2Score) * 100) / 100;

        this.examState.isSubmitted = true;
        this.examState.score = totalScore;
        this.examState.partScores = {
            p1: Math.round(p1Score * 100) / 100,
            p2: Math.round(p2Score * 100) / 100
        };

        this.examHistory.unshift({
            date: new Date().toLocaleString('vi-VN'),
            score: totalScore,
            p1: this.examState.partScores.p1,
            p2: this.examState.partScores.p2,
            timeSpent: (45 * 60) - this.examState.timeLeft
        });

        this.cleanMistakes();
        this.saveState();
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    exitExam() {
        if (this.examState.timerInterval) clearInterval(this.examState.timerInterval);
        this.examState.isActive = false;
        this.examState.isSubmitted = false;
        this.navigateTo('home');
    }

    // =========================================================================
    // XỬ LÝ GIAO DIỆN CHÍNH
    // =========================================================================
    render() {
        const viewport = document.getElementById('app-viewport');
        if (!viewport) return;
        viewport.innerHTML = '';

        const navBtns = ['home', 'practice', 'exam', 'mistakes', 'bookmarks', 'stats'];
        navBtns.forEach(nav => {
            const btn = document.getElementById(`nav-${nav}-btn`);
            if (btn) {
                if (this.currentMode === nav) {
                    btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 text-white shadow-inner flex items-center space-x-1.5";
                } else {
                    btn.className = "px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-600 text-indigo-100 transition-colors flex items-center space-x-1.5";
                }
            }
        });

        if (this.currentMode === 'home') {
            this.renderHomeView(viewport);
        } else if (this.currentMode === 'practice') {
            this.renderPracticeView(viewport);
        } else if (this.currentMode === 'exam') {
            this.renderExamView(viewport);
        } else if (this.currentMode === 'mistakes') {
            this.renderMistakesView(viewport);
        } else if (this.currentMode === 'bookmarks') {
            this.renderBookmarksView(viewport);
        } else if (this.currentMode === 'stats') {
            this.renderStatsView(viewport);
        }
    }

    // 1. HOME VIEW
    renderHomeView(container) {
        const totalQuestions = this.db.length;
        const answeredCount = Object.keys(this.userAnswers).length;
        const mistakeCount = this.mistakes.length;
        const bookmarkCount = this.bookmarks.length;

        container.innerHTML = `
            <div class="space-y-8 animate-fadeIn">
                <!-- Hero Banner -->
                <div class="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
                    <div class="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="max-w-3xl relative z-10 space-y-4">
                        <div class="flex items-center space-x-2">
                            <span class="px-3 py-1 bg-amber-400 text-slate-900 text-xs font-black rounded-full uppercase tracking-wider shadow">
                                Lịch Sử 12 • GDPT Mới
                            </span>
                            <span class="px-3 py-1 bg-white/10 text-indigo-200 text-xs font-medium rounded-full border border-white/10">
                                Học kì I (Bài 1 - Bài 5)
                            </span>
                        </div>
                        <h2 class="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                            Hệ Thống Ôn Tập & Thi Thử Trắc Nghiệm Lịch Sử 12 Giữa Kì 1
                        </h2>
                        <p class="text-indigo-100 text-sm sm:text-base leading-relaxed">
                            Trọn bộ ngân hàng câu hỏi chuẩn kiến thức kĩ năng: 125 câu trắc nghiệm nhiều phương án lựa chọn và 18 chùm câu Đúng/Sai tư liệu lịch sử. Có đầy đủ đáp án & giải thích chuyên sâu.
                        </p>
                        <div class="pt-2 flex flex-wrap gap-3">
                            <button onclick="app.startExam()" class="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center space-x-2">
                                <i class="fa-solid fa-stopwatch"></i>
                                <span>Thi Thử Giữa Kỳ 45 Phút</span>
                            </button>
                            <button onclick="app.navigateTo('practice', 'all')" class="px-5 py-3 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold rounded-xl border border-indigo-400/30 transition-all flex items-center space-x-2">
                                <i class="fa-solid fa-layer-group"></i>
                                <span>Luyện Tập Tất Cả (${totalQuestions} Câu)</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats Bar -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div onclick="app.navigateTo('practice', 'all')" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div class="flex items-center justify-between text-indigo-600 mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Ngân hàng câu</span>
                            <i class="fa-solid fa-database text-lg"></i>
                        </div>
                        <p class="text-2xl font-black text-gray-900">${totalQuestions}</p>
                        <p class="text-xs text-gray-500 mt-0.5">5 Bài học trọng tâm</p>
                    </div>

                    <div onclick="app.navigateTo('stats')" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div class="flex items-center justify-between text-emerald-600 mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Đã luyện tập</span>
                            <i class="fa-solid fa-check-circle text-lg"></i>
                        </div>
                        <p class="text-2xl font-black text-gray-900">${answeredCount}</p>
                        <p class="text-xs text-gray-500 mt-0.5">Tự động lưu tiến độ</p>
                    </div>

                    <div onclick="app.navigateTo('mistakes')" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div class="flex items-center justify-between text-red-600 mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Sổ tay câu sai</span>
                            <i class="fa-solid fa-circle-exclamation text-lg"></i>
                        </div>
                        <p class="text-2xl font-black text-gray-900">${mistakeCount}</p>
                        <p class="text-xs text-gray-500 mt-0.5">Ôn lại để khắc sâu</p>
                    </div>

                    <div onclick="app.navigateTo('bookmarks')" class="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div class="flex items-center justify-between text-amber-500 mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Câu đã lưu</span>
                            <i class="fa-solid fa-star text-lg"></i>
                        </div>
                        <p class="text-2xl font-black text-gray-900">${bookmarkCount}</p>
                        <p class="text-xs text-gray-500 mt-0.5">Xem lại câu quan trọng</p>
                    </div>
                </div>

                <!-- Lessons Grid -->
                <div>
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg sm:text-xl font-black text-gray-900 flex items-center space-x-2">
                            <i class="fa-solid fa-book-open text-indigo-600"></i>
                            <span>Danh Sách 5 Bài Học Ôn Tập Giữa Kì 1</span>
                        </h3>
                        <span class="text-xs font-medium text-gray-500">Bấm vào bài để bắt đầu ôn tập</span>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        ${Object.keys(this.lessons).map(num => {
                            const lNum = parseInt(num);
                            const info = this.lessons[lNum];
                            const lessonQuestions = this.db.filter(q => q.lesson === lNum);
                            const count = lessonQuestions.length;
                            const mcqCount = lessonQuestions.filter(q => q.type === 'mcq').length;
                            const tfCount = lessonQuestions.filter(q => q.type === 'tf').length;

                            return `
                                <div class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all p-5 flex flex-col justify-between group">
                                    <div>
                                        <div class="flex items-center justify-between mb-3">
                                            <span class="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-black rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                Bài ${lNum}
                                            </span>
                                            <span class="text-xs text-gray-500 font-semibold">
                                                ${count} câu (${mcqCount} MCQ • ${tfCount} Đ/S)
                                            </span>
                                        </div>
                                        <h4 class="font-extrabold text-gray-900 text-base mb-2 leading-snug group-hover:text-indigo-700 transition-colors">
                                            ${info.title}
                                        </h4>
                                        <p class="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">
                                            ${info.desc}
                                        </p>
                                    </div>
                                    <div class="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                                        <button onclick="app.navigateTo('practice', ${lNum})" class="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1.5">
                                            <span>Luyện Bài ${lNum}</span>
                                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // 2. PRACTICE VIEW
    renderPracticeView(container) {
        const isAll = this.currentFilter === 'all';
        const title = isAll ? "Ôn Tập Tổng Hợp Tất Cả Các Bài" : this.lessons[this.currentFilter]?.title || `Bài ${this.currentFilter}`;

        container.innerHTML = `
            <div class="space-y-6 animate-fadeIn">
                <!-- Header Lọc & Tìm Kiếm Sticky -->
                <div class="sticky top-16 z-30 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="flex items-center space-x-3">
                            <button onclick="app.navigateTo('home')" class="p-2 text-gray-500 hover:text-indigo-600 rounded-xl hover:bg-gray-100 transition-colors">
                                <i class="fa-solid fa-arrow-left"></i>
                            </button>
                            <div>
                                <h2 class="font-black text-gray-900 text-base sm:text-lg line-clamp-1">${title}</h2>
                                <p class="text-xs text-gray-500">
                                    Đang hiển thị <span id="filtered-count" class="font-bold text-indigo-600">${this.activeQuestions.length}</span> câu hỏi
                                </p>
                            </div>
                        </div>

                        <!-- Actions: Shuffle & Print -->
                        <div class="flex items-center space-x-2 self-end sm:self-auto">
                            <button onclick="app.shufflePractice()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5">
                                <i class="fa-solid fa-shuffle"></i>
                                <span class="hidden sm:inline">Xáo trộn</span>
                            </button>
                            <button onclick="window.print()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5">
                                <i class="fa-solid fa-print"></i>
                                <span class="hidden sm:inline">In / PDF</span>
                            </button>
                        </div>
                    </div>

                    <!-- Filter Controls -->
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-gray-100">
                        <!-- Chọn bài -->
                        <div class="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                            <button onclick="app.navigateTo('practice', 'all')" class="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${this.currentFilter === 'all' ? 'bg-indigo-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                                Tất cả
                            </button>
                            ${[1, 2, 3, 4, 5].map(num => `
                                <button onclick="app.navigateTo('practice', ${num})" class="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${this.currentFilter === num ? 'bg-indigo-700 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                                    Bài ${num}
                                </button>
                            `).join('')}
                        </div>

                        <!-- Lọc theo loại câu & Search -->
                        <div class="flex items-center space-x-2">
                            <select onchange="app.handleTypeFilter(this.value)" class="text-xs bg-gray-100 border-none font-semibold text-gray-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500">
                                <option value="all" ${this.typeFilter === 'all' ? 'selected' : ''}>Tất cả dạng</option>
                                <option value="mcq" ${this.typeFilter === 'mcq' ? 'selected' : ''}>Trắc nghiệm 4 lựa chọn</option>
                                <option value="tf" ${this.typeFilter === 'tf' ? 'selected' : ''}>Trắc nghiệm Đúng/Sai</option>
                            </select>

                            <div class="relative flex-1 sm:w-48">
                                <input type="text" oninput="app.handleSearch(this.value)" placeholder="Tìm kiếm nội dung..." class="w-full text-xs bg-gray-100 border-none rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:ring-indigo-500">
                                <i class="fa-solid fa-magnifying-glass absolute left-2.5 top-2 text-gray-400 text-xs"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Danh sách câu hỏi -->
                <div class="space-y-6" id="questions-list">
                    ${this.activeQuestions.length > 0 
                        ? this.activeQuestions.map((q, idx) => this.generateQuestionCardHTML(q, idx + 1)).join('')
                        : `<div class="bg-white rounded-2xl p-10 text-center text-gray-500 border border-dashed border-gray-300">Không tìm thấy câu hỏi nào phù hợp với bộ lọc hiện tại.</div>`}
                </div>
            </div>
        `;
    }

    shufflePractice() {
        this.activeQuestions = this.shuffleArray(this.activeQuestions);
        const listEl = document.getElementById('questions-list');
        if (listEl) {
            listEl.innerHTML = this.activeQuestions.map((q, idx) => this.generateQuestionCardHTML(q, idx + 1)).join('');
        }
    }

    // Tạo HTML cho từng câu hỏi (MCQ hoặc TF)
    generateQuestionCardHTML(q, indexNumber) {
        const userAns = this.userAnswers[q.id] || {};
        const isBookmarked = this.bookmarks.includes(q.id);

        if (q.type === 'mcq') {
            const hasAnswered = userAns.selected !== undefined && userAns.selected !== null;
            const isCorrect = hasAnswered && parseInt(userAns.selected) === parseInt(q.answer);

            return `
                <div id="card-${q.id}" class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 space-y-4">
                    <!-- Card Top Header -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center space-x-2">
                            <span class="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg shadow-sm">
                                Câu ${indexNumber}
                            </span>
                            <span class="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-md">
                                Bài ${q.lesson} • Trắc nghiệm 4 lựa chọn
                            </span>
                        </div>
                        <div class="flex items-center space-x-2">
                            ${hasAnswered ? `
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                                    <i class="fa-solid ${isCorrect ? 'fa-check' : 'fa-xmark'} mr-1"></i>${isCorrect ? 'Đúng' : 'Sai'}
                                </span>
                            ` : ''}
                            <button onclick="app.toggleBookmark('${q.id}')" title="${isBookmarked ? 'Bỏ lưu' : 'Lưu câu hỏi'}" class="p-1.5 text-gray-400 hover:text-amber-500 transition-colors">
                                <i class="fa-${isBookmarked ? 'solid text-amber-500' : 'regular'} fa-star text-base"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Question Text -->
                    <h3 class="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                        ${q.question}
                    </h3>

                    <!-- Options Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        ${q.options.map((opt, oIdx) => {
                            const char = String.fromCharCode(65 + oIdx);
                            let btnStyle = "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-800 bg-white";
                            let badgeStyle = "bg-gray-100 text-gray-700";

                            if (hasAnswered) {
                                if (oIdx === q.answer) {
                                    btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500";
                                    badgeStyle = "bg-emerald-600 text-white";
                                } else if (parseInt(userAns.selected) === oIdx) {
                                    btnStyle = "border-red-500 bg-red-50 text-red-900 font-bold ring-2 ring-red-500";
                                    badgeStyle = "bg-red-600 text-white";
                                } else {
                                    btnStyle = "border-gray-200 opacity-50 text-gray-500 bg-gray-50";
                                }
                            }

                            return `
                                <button onclick="app.setMCQAnswer('${q.id}', ${oIdx})" class="w-full text-left p-3.5 rounded-xl border transition-all flex items-start space-x-3 text-sm focus:outline-none ${btnStyle}">
                                    <span class="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-xs ${badgeStyle}">
                                        ${char}
                                    </span>
                                    <span class="mt-0.5 leading-relaxed">${opt}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <!-- Explanation Box -->
                    ${hasAnswered ? `
                        <div class="mt-4 p-4 rounded-xl text-sm ${isCorrect ? 'bg-emerald-50 border border-emerald-200 text-emerald-950' : 'bg-red-50 border border-red-200 text-red-950'} space-y-1.5">
                            <div class="flex items-center space-x-2 font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}">
                                <i class="fa-solid ${isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                                <span>${isCorrect ? 'Trả lời chính xác!' : 'Chưa chính xác!'}</span>
                            </div>
                            <p class="text-xs sm:text-sm font-semibold text-gray-800">
                                Đáp án đúng: <span class="text-emerald-700 font-bold">${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}</span>
                            </p>
                            ${q.explanation ? `
                                <div class="pt-2 border-t ${isCorrect ? 'border-emerald-200/60' : 'border-red-200/60'} text-xs leading-relaxed text-gray-700">
                                    <span class="font-bold text-gray-900"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Giải thích chi tiết:</span> ${q.explanation}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (q.type === 'tf') {
            return `
                <div id="card-${q.id}" class="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 space-y-4">
                    <!-- Card Top Header -->
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center space-x-2">
                            <span class="px-3 py-1 bg-purple-700 text-white text-xs font-black rounded-lg shadow-sm">
                                Câu ${indexNumber}
                            </span>
                            <span class="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-md">
                                Bài ${q.lesson} • Trắc nghiệm Đúng / Sai
                            </span>
                        </div>
                        <button onclick="app.toggleBookmark('${q.id}')" title="${isBookmarked ? 'Bỏ lưu' : 'Lưu câu hỏi'}" class="p-1.5 text-gray-400 hover:text-amber-500 transition-colors">
                            <i class="fa-${isBookmarked ? 'solid text-amber-500' : 'regular'} fa-star text-base"></i>
                        </button>
                    </div>

                    <!-- Context Box -->
                    <div class="bg-slate-50 border-l-4 border-purple-600 p-4 rounded-r-xl text-sm italic text-slate-800 leading-relaxed">
                        "${q.context}"
                    </div>

                    <!-- Items List -->
                    <div class="space-y-3 pt-1">
                        ${q.items.map(item => {
                            const userChoice = userAns[item.label];
                            const hasChoice = userChoice !== undefined && userChoice !== null;
                            const isCorrect = hasChoice && userChoice === item.answer;

                            return `
                                <div class="p-3.5 bg-gray-50/80 hover:bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm transition-colors">
                                    <div class="flex items-start space-x-2.5">
                                        <span class="font-black text-purple-700 shrink-0 text-base">${item.label})</span>
                                        <span class="text-gray-800 leading-relaxed font-medium">${item.text}</span>
                                    </div>
                                    
                                    <div class="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                        <button onclick="app.setTFAnswer('${q.id}', '${item.label}', true)" class="px-4 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5 ${
                                            hasChoice && userChoice === true
                                                ? (isCorrect ? 'bg-emerald-600 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm')
                                                : (hasChoice && item.answer === true ? 'border-2 border-emerald-500 text-emerald-700 bg-emerald-50' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100')
                                        }">
                                            <i class="fa-solid fa-check text-xs"></i>
                                            <span>Đúng</span>
                                        </button>

                                        <button onclick="app.setTFAnswer('${q.id}', '${item.label}', false)" class="px-4 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5 ${
                                            hasChoice && userChoice === false
                                                ? (isCorrect ? 'bg-emerald-600 text-white shadow-sm' : 'bg-red-500 text-white shadow-sm')
                                                : (hasChoice && item.answer === false ? 'border-2 border-emerald-500 text-emerald-700 bg-emerald-50' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100')
                                        }">
                                            <i class="fa-solid fa-xmark text-xs"></i>
                                            <span>Sai</span>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Explanation -->
                    ${q.explanation ? `
                        <div class="mt-2 p-3.5 bg-purple-50/70 border border-purple-200/60 rounded-xl text-xs leading-relaxed text-purple-950">
                            <span class="font-bold text-purple-900"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Giải thích & Phân tích tư liệu:</span> ${q.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    updateQuestionCardUI(qId) {
        const cardEl = document.getElementById(`card-${qId}`);
        if (!cardEl) return;

        const q = this.db.find(item => item.id === qId);
        if (!q) return;

        const indexNumber = this.activeQuestions.findIndex(item => item.id === qId) + 1;
        const newCardHtml = this.generateQuestionCardHTML(q, indexNumber > 0 ? indexNumber : 1);
        cardEl.outerHTML = newCardHtml;
    }

    // =========================================================================
    // 3. EXAM VIEW (THI THỬ 45 PHÚT CHUẨN CẤU TRÚC ĐỀ THI BỘ GD&ĐT)
    // =========================================================================
    renderExamView(container) {
        if (!this.examState.isActive) {
            this.startExam();
            return;
        }

        const isSubmitted = this.examState.isSubmitted;
        const questions = this.examState.questions;

        container.innerHTML = `
            <div class="space-y-6 animate-fadeIn pb-12">
                <!-- Exam Top Bar (Sticky) -->
                <div class="sticky top-16 z-40 bg-slate-900 text-white rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-700">
                    <div class="flex items-center space-x-3 w-full sm:w-auto">
                        <div class="w-10 h-10 bg-amber-400 text-slate-900 rounded-xl flex items-center justify-center font-black text-lg shrink-0">
                            <i class="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div>
                            <h2 class="font-extrabold text-sm sm:text-base leading-tight">
                                Đề Thi Thử Lịch Sử 12 - Giữa Kỳ I (2026-2027)
                            </h2>
                            <p class="text-xs text-slate-300">
                                Chuẩn cấu trúc: 24 câu MCQ (6đ) + 4 câu Đ/S (4đ) • Thang điểm 10.0
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                        ${!isSubmitted ? `
                            <div class="flex items-center space-x-2 bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700">
                                <i class="fa-solid fa-clock text-amber-400 text-sm"></i>
                                <span id="exam-timer" class="font-mono text-base font-black text-amber-400">45:00</span>
                            </div>

                            <button onclick="app.submitExam()" class="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow transition-colors flex items-center space-x-1.5">
                                <i class="fa-solid fa-paper-plane"></i>
                                <span>Nộp Bài</span>
                            </button>
                        ` : `
                            <div class="flex items-center space-x-2">
                                <span class="px-3 py-1 bg-amber-400 text-slate-900 font-black text-sm rounded-lg">
                                    Điểm: ${this.examState.score} / 10.0
                                </span>
                                <button onclick="app.startExam()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors">
                                    Thi Lại Đề Mới
                                </button>
                                <button onclick="app.navigateTo('home')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition-colors">
                                    Trang Chủ
                                </button>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Exam Result Summary Box (Sau khi nộp bài) -->
                ${isSubmitted ? `
                    <div class="bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8 space-y-6">
                        <div class="text-center space-y-2">
                            <span class="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-black rounded-full uppercase tracking-wider">
                                Kết Quả Bài Thi Thử Giữa Kỳ 1
                            </span>
                            <h2 class="text-3xl sm:text-5xl font-black text-slate-900">
                                ${this.examState.score} <span class="text-lg sm:text-2xl font-bold text-gray-500">/ 10.0 Điểm</span>
                            </h2>
                            <p class="text-sm font-semibold text-gray-600">
                                ${this.getExamFeedback(this.examState.score)}
                            </p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                            <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                                <p class="text-xs font-bold text-indigo-700 uppercase">Phần I (24 Câu MCQ)</p>
                                <p class="text-2xl font-black text-indigo-900 mt-1">${this.examState.partScores.p1} / 6.0 đ</p>
                                <p class="text-xs text-indigo-500 mt-1">Mỗi câu đúng đạt 0.25 điểm</p>
                            </div>

                            <div class="bg-purple-50 border border-purple-100 rounded-2xl p-4 text-center">
                                <p class="text-xs font-bold text-purple-700 uppercase">Phần II (4 Câu Đúng/Sai)</p>
                                <p class="text-2xl font-black text-purple-900 mt-1">${this.examState.partScores.p2} / 4.0 đ</p>
                                <p class="text-xs text-purple-500 mt-1">Tính theo số ý đúng quy chuẩn</p>
                            </div>
                        </div>

                        <div class="text-center text-xs text-gray-500">
                            Các câu bạn làm sai trong bài thi đã được tự động lưu vào <span class="font-bold text-red-600 cursor-pointer underline" onclick="app.navigateTo('mistakes')">Sổ Tay Câu Sai</span> để bạn ôn tập lại.
                        </div>
                    </div>
                ` : ''}

                <!-- Question Grid / Layout 2 cột (Desktop) -->
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                    <!-- Cột 1: Danh sách câu hỏi (Chiếm 3 cột) -->
                    <div class="lg:col-span-3 space-y-6">
                        <!-- PHẦN 1: 24 CÂU MCQ -->
                        <div class="space-y-4">
                            <div class="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-xl">
                                <h3 class="font-black text-indigo-950 text-base">
                                    PHẦN I: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (24 CÂU - 6.0 ĐIỂM)
                                </h3>
                                <p class="text-xs text-indigo-800 mt-1">
                                    Thí sinh trả lời từ câu 1 đến câu 24. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng.
                                </p>
                            </div>

                            ${questions.filter(q => q.examPart === 1).map(q => this.generateExamCardHTML(q)).join('')}
                        </div>

                        <!-- PHẦN 2: 4 CÂU ĐÚNG / SAI -->
                        <div class="space-y-4 pt-6">
                            <div class="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r-xl">
                                <h3 class="font-black text-purple-950 text-base">
                                    PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG / SAI (4 CÂU - 4.0 ĐIỂM)
                                </h3>
                                <p class="text-xs text-purple-800 mt-1">
                                    Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.
                                </p>
                            </div>

                            ${questions.filter(q => q.examPart === 2).map(q => this.generateExamCardHTML(q)).join('')}
                        </div>
                    </div>

                    <!-- Cột 2: Question Palette (Sticky bên phải) -->
                    <div class="lg:col-span-1 sticky top-36 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-4">
                        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                            <h4 class="font-bold text-gray-900 text-sm">Bảng câu hỏi</h4>
                            <span class="text-xs text-gray-500">${questions.length} câu</span>
                        </div>

                        <div class="space-y-3">
                            <div>
                                <p class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Phần I (MCQ)</p>
                                <div class="grid grid-cols-6 gap-1.5">
                                    ${questions.filter(q => q.examPart === 1).map(q => `
                                        <button id="palette-btn-${q.examIndex}" onclick="document.getElementById('exam-card-${q.examIndex}').scrollIntoView({ behavior: 'smooth', block: 'center' })" class="w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">
                                            ${q.indexInPart}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <div>
                                <p class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Phần II (Đúng/Sai)</p>
                                <div class="grid grid-cols-4 gap-1.5">
                                    ${questions.filter(q => q.examPart === 2).map(q => `
                                        <button id="palette-btn-${q.examIndex}" onclick="document.getElementById('exam-card-${q.examIndex}').scrollIntoView({ behavior: 'smooth', block: 'center' })" class="w-full h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">
                                            Câu ${q.indexInPart}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        ${!isSubmitted ? `
                            <div class="pt-3 border-t border-gray-100">
                                <button onclick="app.submitExam()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors">
                                    Nộp Bài Thi
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Nếu đang làm bài thi, cập nhật trạng thái các nút bảng câu hỏi
        if (!isSubmitted) {
            questions.forEach(q => this.updatePaletteButton(q.examIndex));
        }
    }

    getExamFeedback(score) {
        if (score >= 9.0) return "Xuất sắc! Bạn nắm rất vững toàn bộ kiến thức Lịch Sử 12 Giữa Kỳ 1!";
        if (score >= 8.0) return "Rất tốt! Bạn đạt điểm Giỏi, hãy ôn lại một số câu nhỏ để đạt điểm tuyệt đối!";
        if (score >= 6.5) return "Khá! Nắm vững kiến thức cơ bản, cần rèn luyện thêm kỹ năng đọc hiểu tư liệu.";
        if (score >= 5.0) return "Trung bình! Hãy ôn tập lại các bài học và luyện lại trong Sổ Tay Câu Sai.";
        return "Cần cố gắng nhiều hơn! Hãy đọc kỹ lại SGK và luyện tập từng bài để củng cố nền tảng.";
    }

    // Sinh HTML Card câu hỏi trong Đề Thi Thử
    generateExamCardHTML(q) {
        const isSubmitted = this.examState.isSubmitted;
        const uAns = this.examState.userAnswers[q.examIndex] || {};

        if (q.examPart === 1) {
            const hasSelected = uAns.selected !== null && uAns.selected !== undefined;
            const isCorrect = isSubmitted && hasSelected && parseInt(uAns.selected) === parseInt(q.answer);

            return `
                <div id="exam-card-${q.examIndex}" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg">
                            Câu ${q.indexInPart}
                        </span>
                        ${isSubmitted ? `
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                                <i class="fa-solid ${isCorrect ? 'fa-check' : 'fa-xmark'} mr-1"></i>${isCorrect ? '+0.25 điểm' : '0 điểm'}
                            </span>
                        ` : ''}
                    </div>

                    <h4 class="text-base font-bold text-gray-900 leading-snug">
                        ${q.question}
                    </h4>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        ${q.options.map((opt, oIdx) => {
                            const char = String.fromCharCode(65 + oIdx);
                            let btnStyle = "border-gray-200 hover:bg-indigo-50/50 text-gray-800 bg-white";
                            let badgeStyle = "bg-gray-100 text-gray-700";

                            if (!isSubmitted) {
                                if (uAns.selected === oIdx) {
                                    btnStyle = "border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-2 ring-indigo-500";
                                    badgeStyle = "bg-indigo-600 text-white";
                                }
                            } else {
                                if (oIdx === q.answer) {
                                    btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500";
                                    badgeStyle = "bg-emerald-600 text-white";
                                } else if (uAns.selected === oIdx) {
                                    btnStyle = "border-red-500 bg-red-50 text-red-900 font-bold ring-2 ring-red-500";
                                    badgeStyle = "bg-red-600 text-white";
                                } else {
                                    btnStyle = "border-gray-200 opacity-50 text-gray-500 bg-gray-50";
                                }
                            }

                            return `
                                <button onclick="app.setExamMCQAnswer(${q.examIndex}, ${oIdx})" ${isSubmitted ? 'disabled' : ''} class="mcq-exam-btn w-full text-left p-3.5 rounded-xl border flex items-start space-x-3 text-sm transition-all ${btnStyle}">
                                    <span class="mcq-badge w-6 h-6 rounded-lg shrink-0 flex items-center justify-center font-extrabold text-xs ${badgeStyle}">
                                        ${char}
                                    </span>
                                    <span class="mt-0.5 leading-relaxed">${opt}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    ${isSubmitted ? `
                        <div class="mt-3 p-3.5 bg-gray-50 rounded-xl text-xs text-gray-700 leading-relaxed border border-gray-200">
                            <span class="font-bold text-gray-900"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Giải thích:</span> ${q.explanation || 'Đáp án đúng là ' + String.fromCharCode(65 + q.answer)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (q.examPart === 2) {
            return `
                <div id="exam-card-${q.examIndex}" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="px-3 py-1 bg-purple-700 text-white text-xs font-black rounded-lg">
                            Câu ${q.indexInPart} (Đúng / Sai)
                        </span>
                        <span class="text-xs text-gray-500">Tối đa 1.0 điểm</span>
                    </div>

                    <div class="bg-slate-50 border-l-4 border-purple-600 p-4 rounded-r-xl text-sm italic text-slate-800 leading-relaxed">
                        "${q.context}"
                    </div>

                    <div class="space-y-3 pt-1">
                        ${q.items.map(item => {
                            const userVal = uAns.tf ? uAns.tf[item.label] : uAns[item.label];
                            const hasChoice = userVal !== undefined && userVal !== null;
                            const isCorrect = isSubmitted && hasChoice && Boolean(userVal) === Boolean(item.answer);

                            return `
                                <div class="tf-row-${item.label} p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                                    <div class="flex items-start space-x-2.5">
                                        <span class="font-black text-purple-700 shrink-0 text-base">${item.label})</span>
                                        <span class="text-gray-800 leading-relaxed font-medium">${item.text}</span>
                                    </div>
                                    
                                    <div class="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                        <button onclick="app.setExamTFAnswer(${q.examIndex}, '${item.label}', true)" ${isSubmitted ? 'disabled' : ''} class="tf-btn-true px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1 ${
                                            !isSubmitted 
                                                ? (userVal === true ? 'bg-purple-700 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100')
                                                : (userVal === true 
                                                    ? (isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white')
                                                    : (item.answer === true ? 'border-2 border-emerald-500 text-emerald-700 bg-emerald-50' : 'bg-gray-100 text-gray-400'))
                                        }">
                                            <i class="fa-solid fa-check text-xs"></i>
                                            <span>Đúng</span>
                                        </button>

                                        <button onclick="app.setExamTFAnswer(${q.examIndex}, '${item.label}', false)" ${isSubmitted ? 'disabled' : ''} class="tf-btn-false px-3.5 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1 ${
                                            !isSubmitted 
                                                ? (userVal === false ? 'bg-purple-700 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100')
                                                : (userVal === false 
                                                    ? (isCorrect ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white')
                                                    : (item.answer === false ? 'border-2 border-emerald-500 text-emerald-700 bg-emerald-50' : 'bg-gray-100 text-gray-400'))
                                        }">
                                            <i class="fa-solid fa-xmark text-xs"></i>
                                            <span>Sai</span>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    ${isSubmitted ? `
                        <div class="mt-3 p-3.5 bg-purple-50 rounded-xl text-xs text-purple-950 leading-relaxed border border-purple-200">
                            <span class="font-bold text-purple-900"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Giải thích:</span> ${q.explanation || ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    // =========================================================================
    // 4. MISTAKES VIEW (SỔ TAY CÂU SAI)
    // =========================================================================
    renderMistakesView(container) {
        this.cleanMistakes();
        const wrongQuestions = this.db.filter(q => this.mistakes.includes(q.id) && !this.isQuestionCorrect(q));

        container.innerHTML = `
            <div class="space-y-6 animate-fadeIn">
                <!-- Header -->
                <div class="bg-red-50 border border-red-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-xl shrink-0">
                            <i class="fa-solid fa-circle-exclamation"></i>
                        </div>
                        <div>
                            <h2 class="text-lg sm:text-xl font-black text-red-950">Sổ Tay Câu Sai (${wrongQuestions.length} Câu)</h2>
                            <p class="text-xs text-red-700 mt-0.5">
                                Tự động lưu các câu bạn từng làm sai khi Luyện tập hoặc Thi thử. Làm lại đúng sẽ tự động xoá khỏi sổ tay!
                            </p>
                        </div>
                    </div>

                    ${wrongQuestions.length > 0 ? `
                        <button onclick="app.clearAllMistakes()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5 shrink-0">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Xóa Toàn Bộ Sổ Tay</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Questions List -->
                <div class="space-y-6" id="questions-list">
                    ${wrongQuestions.length > 0 
                        ? wrongQuestions.map((q, idx) => this.generateQuestionCardHTML(q, idx + 1)).join('')
                        : `
                            <div class="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-3">
                                <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                                    <i class="fa-solid fa-circle-check"></i>
                                </div>
                                <h3 class="text-lg font-bold text-gray-900">Tuyệt vời! Bạn không còn câu sai nào!</h3>
                                <p class="text-xs text-gray-500 max-w-md mx-auto">
                                    Toàn bộ các câu bạn từng trả lời chưa đúng đã được khắc phục hoàn toàn. Hãy tiếp tục luyện tập đề thi thử 45 phút!
                                </p>
                                <div class="pt-2">
                                    <button onclick="app.startExam()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition-colors">
                                        Làm Bài Thi Thử Ngay
                                    </button>
                                </div>
                            </div>
                        `}
                </div>
            </div>
        `;
    }

    clearAllMistakes() {
        if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách câu sai hiện tại?")) return;
        this.mistakes = [];
        this.saveState();
        this.render();
    }

    // =========================================================================
    // 5. BOOKMARKS VIEW (CÂU ĐÃ LƯU)
    // =========================================================================
    renderBookmarksView(container) {
        const bookmarkedQuestions = this.db.filter(q => this.bookmarks.includes(q.id));

        container.innerHTML = `
            <div class="space-y-6 animate-fadeIn">
                <!-- Header -->
                <div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-xl shrink-0">
                            <i class="fa-solid fa-star"></i>
                        </div>
                        <div>
                            <h2 class="text-lg sm:text-xl font-black text-amber-950">Danh Sách Câu Hỏi Đã Lưu (${bookmarkedQuestions.length} Câu)</h2>
                            <p class="text-xs text-amber-700 mt-0.5">
                                Các câu hỏi quan trọng bạn đã đánh dấu ngôi sao ⭐ để tiện ôn tập lại bất kỳ lúc nào.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Questions List -->
                <div class="space-y-6" id="questions-list">
                    ${bookmarkedQuestions.length > 0 
                        ? bookmarkedQuestions.map((q, idx) => this.generateQuestionCardHTML(q, idx + 1)).join('')
                        : `
                            <div class="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-3">
                                <div class="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto text-2xl">
                                    <i class="fa-regular fa-star"></i>
                                </div>
                                <h3 class="text-lg font-bold text-gray-900">Bạn chưa lưu câu hỏi nào!</h3>
                                <p class="text-xs text-gray-500 max-w-md mx-auto">
                                    Trong quá trình Luyện tập, hãy bấm vào biểu tượng ngôi sao ⭐ trên từng câu hỏi để lưu lại vào đây.
                                </p>
                                <div class="pt-2">
                                    <button onclick="app.navigateTo('practice', 'all')" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition-colors">
                                        Đi Đến Luyện Tập
                                    </button>
                                </div>
                            </div>
                        `}
                </div>
            </div>
        `;
    }

    // =========================================================================
    // 6. STATS VIEW (THỐNG KÊ TIẾN ĐỘ & LỊCH SỬ THI THỬ)
    // =========================================================================
    renderStatsView(container) {
        let mcqTotal = 0, mcqAnswered = 0, mcqCorrect = 0;
        let tfTotal = 0, tfAnswered = 0, tfCorrect = 0;

        this.db.forEach(q => {
            const uAns = this.userAnswers[q.id] || {};
            if (q.type === 'mcq') {
                mcqTotal++;
                if (uAns.selected !== undefined && uAns.selected !== null) {
                    mcqAnswered++;
                    if (parseInt(uAns.selected) === parseInt(q.answer)) mcqCorrect++;
                }
            } else if (q.type === 'tf') {
                q.items.forEach(item => {
                    tfTotal++;
                    if (uAns[item.label] !== undefined && uAns[item.label] !== null) {
                        tfAnswered++;
                        if (uAns[item.label] === item.answer) tfCorrect++;
                    }
                });
            }
        });

        const grandTotal = mcqTotal + tfTotal;
        const grandAnswered = mcqAnswered + tfAnswered;
        const grandCorrect = mcqCorrect + tfCorrect;
        const grandAccuracy = grandAnswered > 0 ? Math.round((grandCorrect / grandAnswered) * 100) : 0;

        const mcqAccuracy = mcqAnswered > 0 ? Math.round((mcqCorrect / mcqAnswered) * 100) : 0;
        const tfAccuracy = tfAnswered > 0 ? Math.round((tfCorrect / tfAnswered) * 100) : 0;

        container.innerHTML = `
            <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                <div class="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
                    <!-- Top Title -->
                    <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                        <div>
                            <h2 class="text-xl sm:text-2xl font-black text-gray-900">Báo Cáo Tiến Độ & Năng Lực Ôn Tập</h2>
                            <p class="text-xs text-gray-500">Dữ liệu phân tích chi tiết môn Lịch Sử 12 Giữa Kỳ 1</p>
                        </div>
                        <button onclick="app.clearAllData()" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Xóa Lịch Sử</span>
                        </button>
                    </div>

                    <!-- 3 Metric Cards -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center">
                            <p class="text-xs font-bold text-indigo-700 uppercase tracking-wider">Đã Trả Lời</p>
                            <p class="text-3xl font-black text-indigo-950 mt-1">${grandAnswered} / ${grandTotal}</p>
                            <p class="text-xs text-indigo-500 mt-1">Câu & Mệnh đề lịch sử</p>
                        </div>

                        <div class="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-center">
                            <p class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Số Câu Đúng</p>
                            <p class="text-3xl font-black text-emerald-950 mt-1">${grandCorrect}</p>
                            <p class="text-xs text-emerald-500 mt-1">Đạt yêu cầu chính xác</p>
                        </div>

                        <div class="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
                            <p class="text-xs font-bold text-amber-700 uppercase tracking-wider">Độ Chính Xác</p>
                            <p class="text-3xl font-black text-amber-950 mt-1">${grandAccuracy}%</p>
                            <p class="text-xs text-amber-500 mt-1">Tỷ lệ trả lời đúng</p>
                        </div>
                    </div>

                    <!-- Tiến độ theo từng bài học -->
                    <div class="space-y-4 pt-4 border-t border-gray-100">
                        <h3 class="font-extrabold text-gray-900 text-base">Tiến Độ Theo Từng Bài Học</h3>
                        
                        <div class="space-y-3">
                            ${Object.keys(this.lessons).map(num => {
                                const lNum = parseInt(num);
                                const lQuestions = this.db.filter(q => q.lesson === lNum);
                                let lTotal = 0, lCorrect = 0, lAnswered = 0;

                                lQuestions.forEach(q => {
                                    const uAns = this.userAnswers[q.id] || {};
                                    if (q.type === 'mcq') {
                                        lTotal++;
                                        if (uAns.selected !== undefined && uAns.selected !== null) {
                                            lAnswered++;
                                            if (parseInt(uAns.selected) === parseInt(q.answer)) lCorrect++;
                                        }
                                    } else if (q.type === 'tf') {
                                        q.items.forEach(item => {
                                            lTotal++;
                                            if (uAns[item.label] !== undefined && uAns[item.label] !== null) {
                                                lAnswered++;
                                                if (uAns[item.label] === item.answer) lCorrect++;
                                            }
                                        });
                                    }
                                });

                                const pct = lTotal > 0 ? Math.round((lAnswered / lTotal) * 100) : 0;
                                const acc = lAnswered > 0 ? Math.round((lCorrect / lAnswered) * 100) : 0;

                                return `
                                    <div class="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                                        <div class="flex justify-between items-center text-xs mb-1.5 font-bold">
                                            <span class="text-gray-900">Bài ${lNum}: ${this.lessons[lNum].shortTitle}</span>
                                            <span class="text-indigo-600">Đã làm ${lAnswered}/${lTotal} (${pct}%) • Đúng ${acc}%</span>
                                        </div>
                                        <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                            <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Lịch Sử Các Lần Thi Thử -->
                    <div class="space-y-4 pt-4 border-t border-gray-100">
                        <div class="flex items-center justify-between">
                            <h3 class="font-extrabold text-gray-900 text-base">Lịch Sử Các Lần Thi Thử</h3>
                            <span class="text-xs text-gray-500">${this.examHistory.length} lần thi</span>
                        </div>

                        ${this.examHistory.length > 0 ? `
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                                    <thead class="bg-gray-100 text-gray-700 font-bold uppercase">
                                        <tr>
                                            <th class="p-3">Thời gian</th>
                                            <th class="p-3">Điểm tổng</th>
                                            <th class="p-3">Phần I (MCQ)</th>
                                            <th class="p-3">Phần II (Đ/S)</th>
                                            <th class="p-3">Thời gian làm</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200 bg-white">
                                        ${this.examHistory.map(h => `
                                            <tr class="hover:bg-gray-50">
                                                <td class="p-3 font-medium text-gray-900">${h.date}</td>
                                                <td class="p-3 font-black text-indigo-700 text-sm">${h.score} / 10.0</td>
                                                <td class="p-3">${h.p1} / 6.0 đ</td>
                                                <td class="p-3">${h.p2} / 4.0 đ</td>
                                                <td class="p-3 text-gray-500">${Math.floor(h.timeSpent / 60)}p ${h.timeSpent % 60}s</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <p class="text-xs text-gray-500 italic">Bạn chưa thực hiện lần thi thử nào. Hãy bắt đầu thi thử 45 phút ngay!</p>
                        `}
                    </div>

                    <!-- Bottom Action -->
                    <div class="pt-4 border-t border-gray-100 flex justify-center space-x-3">
                        <button onclick="app.startExam()" class="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs sm:text-sm rounded-xl shadow transition-all">
                            <i class="fa-solid fa-stopwatch mr-1.5"></i> Thi Thử 45 Phút
                        </button>
                        <button onclick="app.navigateTo('practice', 'all')" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow transition-all">
                            <i class="fa-solid fa-play mr-1.5"></i> Tiếp Tục Ôn Luyện
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    clearAllData() {
        if (!confirm("CẢNH BÁO: Hành động này sẽ xóa toàn bộ tiến trình làm bài, sổ tay câu sai, câu đã lưu và lịch sử thi thử. Bạn có chắc chắn muốn xóa?")) return;
        this.userAnswers = {};
        this.mistakes = [];
        this.bookmarks = [];
        this.examHistory = [];
        this.saveState();
        this.render();
    }
}

// Khởi tạo Singleton Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new HistoryQuizApp();
});
