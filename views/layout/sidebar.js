// js/sidebar.js
document.addEventListener("DOMContentLoaded", function () {
    const buttons = document.querySelectorAll('.menu-multi, .menu-multi1, .menu-multi2, .menu-multi3, .menu-multi4, .menu-multi5, .menu-multi6');
    const pageTitle = document.getElementById('page-title');

    buttons.forEach(button => {
        button.addEventListener('click', function () {
            const newTitle = this.getAttribute('data-title');
            pageTitle.textContent = newTitle;
        });
    });
});
