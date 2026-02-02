document.addEventListener('DOMContentLoaded', () => {
    const inputDataElement = document.getElementById('inputData');
    const filterFieldElement = document.getElementById('filterField');
    const processButton = document.getElementById('processButton');
    const outputResultElement = document.getElementById('outputResult');
    const copyButton = document.getElementById('copyButton');
    const resultInfo = document.getElementById('resultInfo');

    // === Xử lý Popup Thông Báo ===
    const notificationPopup = document.getElementById('notificationPopup');
    const closePopupX = document.getElementById('closePopupX');
    const dontShowAgainCheckbox = document.getElementById('dontShowAgain');
    
    // Kiểm tra xem popup đã được đóng trong vòng 24h chưa
    const popupClosedTime = localStorage.getItem('popupClosedTime');
    const now = new Date().getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24 giờ tính bằng milliseconds
    
    if (!popupClosedTime || (now - parseInt(popupClosedTime)) > twentyFourHours) {
        // Hiển thị popup nếu chưa đóng hoặc đã hết 24h
        notificationPopup.classList.remove('hidden');
    } else {
        // Ẩn popup nếu vẫn còn trong 24h
        notificationPopup.classList.add('hidden');
    }
    
    // Hàm đóng popup
    function closePopup() {
        notificationPopup.classList.add('hidden');
        
        // Nếu checkbox được chọn, lưu thời gian đóng
        if (dontShowAgainCheckbox.checked) {
            localStorage.setItem('popupClosedTime', new Date().getTime().toString());
        }
    }
    
    // Xử lý sự kiện đóng popup bằng nút X
    closePopupX.addEventListener('click', closePopup);
    
    // Đóng popup khi click vào overlay (vùng ngoài)
    notificationPopup.addEventListener('click', (e) => {
        if (e.target === notificationPopup) {
            closePopup();
        }
    });
    
    // Xử lý các nút social (có thể thêm link thực tế vào đây)
    const socialButtons = document.querySelectorAll('.social-btn[data-platform]');
    socialButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const platform = btn.getAttribute('data-platform');
            // Có thể thêm link cho từng platform ở đây
            alert(`Chức năng ${platform} đang được cập nhật!`);
        });
    });

    // === Hàm Lọc Dữ liệu Không Cấu trúc (Tương đương filter_unstructured_data) ===
    function filterUnstructuredData(rawData) {
        const extractedValues = new Set();
        const lines = rawData.split('\n');

        // Regex để tìm Namechar sau các tag như [số] hoặc [TAG].
        const patternTag = /^\[[^\]]+\]\s*([a-zA-Z0-9_]+)$/;

        // Các mẫu nhiễu cần loại bỏ (Case-insensitive)
        const noisePatterns = [
            /^broly\s+\d+/i, // Loại bỏ "Broly 22", "Broly 4"
            /^\$đệ\s+tử/i,   // Loại bỏ "$Đệ tử"
        ];

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // 1. Kiểm tra Pattern Tag (Namechar có tag đi kèm)
            let matchTag = line.match(patternTag);
            if (matchTag) {
                extractedValues.add(matchTag[1]);
                continue;
            }

            // 2. Kiểm tra các dòng nhiễu
            let isNoise = false;
            for (let noisePattern of noisePatterns) {
                if (line.match(noisePattern)) {
                    isNoise = true;
                    break;
                }
            }
            if (isNoise) continue;

            // 3. Kiểm tra Namechar độc lập (Standalone Namechar)
            // Giả sử Namechar độc lập là một chuỗi chữ cái/số không có khoảng trắng 
            // và có ít nhất 5 ký tự.
            if (line.match(/^[a-zA-Z0-9_]{5,}$/)) {
                extractedValues.add(line);
            }
        }

        // Trả về chuỗi kết quả đã được ghép từ set (không trùng lặp)
        return Array.from(extractedValues).sort().join(',');
    }

    // === Hàm Xử lý Chính (Tương đương process_data) ===
    processButton.addEventListener('click', () => {
        outputResultElement.value = '';
        resultInfo.textContent = '';
        
        const rawData = inputDataElement.value.trim();
        const truongCanLoc = filterFieldElement.value; // Lấy giá trị nội bộ

        if (!rawData) {
            alert("Lỗi: Vui lòng dán dữ liệu thô vào ô nhập liệu.");
            return;
        }

        let resultString = '';
        let extractedValues = [];

        if (truongCanLoc === 'namechar_unstructured') {
            // === LOGIC MỚI: Lọc Namechar không cấu trúc ===
            resultString = filterUnstructuredData(rawData);

        } else {
            // === LOGIC CŨ: Lọc Dữ liệu có cấu trúc (|) ===

            // Xác định chỉ mục dựa trên lựa chọn của người dùng
            const chiMucLocMap = {
                'idchar': 0,    // Chỉ mục cho ID/ID Char
                'id': 0,        // Chỉ mục cho ID
                'namechar': 1,  // Chỉ mục cho Namechar
                'sucmanh': 2    // Chỉ mục cho Sức Mạnh
            };
            
            // Đảm bảo lấy chỉ mục 0 nếu là 'idchar' hoặc 'id'
            const chiMucLoc = chiMucLocMap[truongCanLoc] !== undefined ? chiMucLocMap[truongCanLoc] : 1; 

            const lines = rawData.split('\n');

            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                // Phân tách các phần tử bằng ký tự "|"
                const parts = line.split('|');

                // Đảm bảo dòng có ít nhất 3 phần tử (ID, Namechar, Sức Mạnh)
                if (parts.length >= 3) {
                    try {
                        // Lấy giá trị tại chỉ mục đã chọn và loại bỏ khoảng trắng dư thừa
                        let value = parts[chiMucLoc].trim();
                        
                        // Xử lý Namechar có cấu trúc để loại bỏ tag [...]
                        // Chỉ áp dụng logic xóa tag khi truongCanLoc là 'namechar'
                        if (truongCanLoc === 'namechar') {
                            value = value.replace(/\[[^\]]*\]/g, '').trim();
                        }

                        if (value) {
                            // Dùng Set để đảm bảo không trùng lặp (nếu bạn muốn kết quả không trùng lặp)
                            // Hiện tại extractedValues là Array, chúng ta sẽ làm sạch trùng lặp sau.
                            extractedValues.push(value);
                        }
                    } catch (e) {
                        // Bỏ qua nếu có lỗi
                        continue;
                    }
                }
            }

            // Loại bỏ trùng lặp và ghép thành chuỗi
            resultString = Array.from(new Set(extractedValues)).join(',');
        }

        // Hiển thị kết quả
        outputResultElement.value = resultString;

        // Hiển thị thông báo hoàn thành
        const count = resultString ? resultString.split(',').length : 0;
        if (count > 0) {
            resultInfo.textContent = `✓ Hoàn thành: Đã lọc thành công ${count} giá trị.`;
            resultInfo.style.color = '#81c784';
            alert(`Hoàn thành: Đã lọc thành công ${count} giá trị.`);
        } else {
            resultInfo.textContent = 'Không tìm thấy dữ liệu phù hợp';
            resultInfo.style.color = '#ef5350';
            alert('Cảnh báo: Không tìm thấy dữ liệu phù hợp.');
        }
    });

    // === Hàm Sao chép Kết quả ===
    copyButton.addEventListener('click', () => {
        const result = outputResultElement.value.trim();
        if (result) {
            // Sử dụng Clipboard API hiện đại
            navigator.clipboard.writeText(result)
                .then(() => {
                    const originalText = copyButton.textContent;
                    copyButton.textContent = '✓ Đã sao chép!';
                    copyButton.style.background = 'linear-gradient(135deg, #66bb6a 0%, #4caf50 100%)';
                    
                    alert("Sao chép: Đã sao chép chuỗi kết quả vào clipboard!");
                    
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                        copyButton.style.background = 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)';
                    }, 2000);
                })
                .catch(err => {
                    // Fallback cho trình duyệt cũ hoặc lỗi
                    console.error('Không thể sao chép văn bản: ', err);
                    alert("Cảnh báo: Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.");
                });
        } else {
            alert("Cảnh báo: Không có kết quả để sao chép.");
        }
    });

    // Thêm placeholder động
    filterFieldElement.addEventListener('change', function() {
        const value = this.value;
        
        if (value === 'idchar' || value === 'id') {
            inputDataElement.placeholder = `Ví dụ (Kết quả: 123, 456, 789):
123|ten_char_A|99999999|misc
456|ten_char_B|88888888|misc
789|ten_char_C|77777777|misc`;
        } else if (value === 'namechar') {
            inputDataElement.placeholder = `Ví dụ (Kết quả: ten_char_A, ten_char_B):
123|[PT] ten_char_A|99999999|misc
456|ten_char_B|88888888|misc
789|[ABC] ten_char_C|77777777|misc`;
        } else if (value === 'sucmanh') {
            inputDataElement.placeholder = `Ví dụ:
123|ten_char_A|99999999|misc
456|ten_char_B|88888888|misc
789|ten_char_C|77777777|misc`;
        } else if (value === 'namechar_unstructured') {
            inputDataElement.placeholder = `Ví dụ:
[240] ten_char_A
[150] ten_char_B
[300] ten_char_C`;
        }
    });
});