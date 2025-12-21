// 页面滚动跳转
function scrollToPage(pageIndex) {
    const container = document.querySelector('.container');
    const height = window.innerHeight;
    container.scrollTo({
        top: height * pageIndex,
        behavior: 'smooth'
    });
}

// 预览图更新逻辑
function updatePreview(imageName) {
    const previewImg = document.getElementById('preview-img');
    
    // 添加一个简单的淡入淡出效果
    previewImg.style.opacity = '0.5';
    
    setTimeout(() => {
        // 这里假设图片都放在根目录下
        previewImg.src = imageName;
        previewImg.style.opacity = '1';
    }, 100);
}

// 处理鼠标滚轮干扰（可选：增强PPT翻页感）
// 如果需要完全禁止中间停留，可以添加更复杂的轮询检测，
// 但目前CSS scroll-snap 已经能处理大部分现代浏览器的PPT效果。