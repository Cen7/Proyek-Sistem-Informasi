document.addEventListener("DOMContentLoaded", function () {
    const buttons = document.querySelectorAll('.menu-multi');
    
    // Fungsi untuk mendapatkan current path
    function getCurrentPath() {
        return window.location.pathname;
    }

    // Fungsi untuk menentukan menu mana yang aktif
    function determineActiveMenu(path) {
        // Mapping halaman detail ke halaman induk
        const pageMapping = {
            // Pengajuan Lapak
            'admin-informasi-lapak-pengajuan': 'admin-pengajuan',
            
            // Lapak Terverifikasi
            'admin-informasi-lapak-terverifikasi': 'admin-terverifikasi',
            
            // Lapak Terblokir
            'admin-informasi-lapak-terblokir': 'admin-lapak-terblokir',
            
            // Pembaruan Lapak
            'admin-informasi-pembaruan': 'admin-pembaruan',
            
            // Pusat Ulasan
            'admin-detail-ulasan': 'admin-ulasan'
        };

        // Dapatkan base path (segment pertama dari URL)
        const basePath = path.split('/')[1];

        // Cek apakah current path ada dalam mapping
        for (const [detailPath, parentPath] of Object.entries(pageMapping)) {
            if (basePath.startsWith(detailPath)) {
                return parentPath;
            }
        }

        return basePath || 'dashboard';
    }

    // Fungsi untuk mengatur active state
    function setActiveMenu() {
        const currentPath = getCurrentPath();
        const activeMenu = determineActiveMenu(currentPath);

        buttons.forEach(button => {
            // Cek data-page attribute terlebih dahulu
            const dataPage = button.getAttribute('data-page');
            
            // Jika tidak ada data-page, cari dari onclick
            const clickableDiv = button.querySelector('[onclick]');
            const onclickPath = clickableDiv ? 
                clickableDiv.getAttribute('onclick').match(/href='([^']+)'/)?.[1]?.replace(/^\//, '') : 
                null;
            
            const targetPath = dataPage || onclickPath;

            if (targetPath === activeMenu) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // Event listener untuk setiap menu
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Jika yang diklik adalah elemen dengan onclick sendiri, biarkan
            if (e.target.hasAttribute('onclick')) {
                return;
            }

            // Cari element dengan onclick di dalam button
            const clickableElement = button.querySelector('[onclick]');
            if (clickableElement) {
                // Simulasi klik pada element yang memiliki onclick
                const onclickAttr = clickableElement.getAttribute('onclick');
                if (onclickAttr) {
                    eval(onclickAttr);
                }
            }
        });
    });

    // Set active menu saat halaman dimuat
    setActiveMenu();

    // Handle back button dan browser navigation
    window.addEventListener('popstate', function() {
        setActiveMenu();
    });
});