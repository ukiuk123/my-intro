document.addEventListener('DOMContentLoaded', () => {
    // スクロールアニメーション用のIntersection Observer
    const scrollElements = document.querySelectorAll('.js-scroll');

    const elementInView = (el, dividend = 1) => {
        const elementTop = el.getBoundingClientRect().top;
        return (
            elementTop <=
            (window.innerHeight || document.documentElement.clientHeight) / dividend
        );
    };

    const displayScrollElement = (element) => {
        element.classList.add('scrolled');
    };

    const handleScrollAnimation = () => {
        scrollElements.forEach((el) => {
            if (elementInView(el, 1.25)) {
                displayScrollElement(el);
            }
        });
    };

    // 初期ロード時のチェック
    handleScrollAnimation();

    // スクロールイベントリスナー（スロットルなどで最適化すると更に良い）
    window.addEventListener('scroll', () => {
        handleScrollAnimation();
    });
});
