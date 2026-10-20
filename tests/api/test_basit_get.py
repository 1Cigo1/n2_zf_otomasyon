


def test_tema_get(api_request):
    # 1. GET isteğini gönder.
    response = api_request.get("/api/company/themes")

    # 2. HTTP sonucunu kontrol et.
    assert response.status == 200

    # 3. Bu API JSON döndürür: gerekli alanlara bak.
    data = response.json()
    assert isinstance(data, dict)
    assert "colors" in data
    assert "assets" in data

    print("\nTema API JSON alanları:", list(data), flush=True)
