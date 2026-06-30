import os

def test_no_ad_domains_in_code():
    """
    Vérifie que des domaines publicitaires connus ne sont pas réintroduits
    dans le frontend (ex: Trafficstars, ad networks, popunders).
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(base_dir, 'static')
    
    files_to_check = [
        os.path.join(static_dir, 'index.html'),
        os.path.join(static_dir, 'main.js')
    ]
    
    forbidden_keywords = [
        "trafficstars",
        "popunder",
        "adcash",
        "propellerads",
        "redirect_url"
    ]
    
    for file_path in files_to_check:
        assert os.path.exists(file_path), f"Fichier {file_path} introuvable"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().lower()
            
            for keyword in forbidden_keywords:
                assert keyword not in content, f"ALERTE SÉCURITÉ : Le mot-clé interdit '{keyword}' a été trouvé dans {os.path.basename(file_path)}. Risque de régression."

def test_hls_version_pinned():
    """
    S'assure que la version de HLS.js est bien fixée pour éviter une casse silencieuse.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    index_path = os.path.join(base_dir, 'static', 'index.html')
    
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()
        assert "hls.js@1.4.14" in content, "La version exacte de hls.js@1.4.14 doit être utilisée dans index.html !"
