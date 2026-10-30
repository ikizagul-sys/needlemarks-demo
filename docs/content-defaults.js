export const legalDefaults = [
  {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    body: "Bu alan, NEEDLEMARKS mağazasının onaylanmış KVKK aydınlatma metni için ayrılmıştır.\n\nBu sürüm bir tasarım demosudur. Gerçek şirket ve veri işleme bilgileri henüz eklenmedi. Panelde Yasal metinler bölümünden düzenlenebilir.",
  },
  {
    id: "cerez",
    title: "Çerez Politikası",
    body: "Bu demo; sepeti, favorileri ve örnek panel değişikliklerini aynı tarayıcıda saklar. Reklam veya analitik hizmeti bağlı değildir.\n\nBu alan marka tarafından onaylanan çerez politikasıyla değiştirilmek üzere hazırlanmıştır.",
  },
  {
    id: "on-bilgilendirme",
    title: "Ön Bilgilendirme Formu",
    body: "Bu alan mağazanın onaylanmış ön bilgilendirme formu için ayrılmıştır.\n\nDemo akışında ödeme, gerçek satış sözleşmesi veya gönderim oluşturulmaz. Firma ve ürün koşulları henüz tanımlanmadı.",
  },
  {
    id: "gizlilik",
    title: "Gizlilik Politikası",
    body: "Bu alan, marka tarafından onaylanan gizlilik politikası için ayrılmıştır.\n\nGitHub demosundaki bilgiler yalnızca aynı tarayıcıda kalır. Gerçek kişisel bilgiler yerine örnek bilgiler kullanın.",
  },
  {
    id: "mesafeli-satis",
    title: "Mesafeli Satış Sözleşmesi",
    body: "Bu alan, NEEDLEMARKS mağazasının onaylanmış mesafeli satış sözleşmesi için ayrılmıştır.\n\nDemo siparişleri gerçek tahsilat veya sözleşme oluşturmaz. Gerçek satış koşulları marka tarafından sağlanmalıdır.",
  },
  {
    id: "kargo",
    title: "Kargo ve teslimat",
    body: "Bu bir demo mağazasıdır; gerçek gönderim yapılmaz.\n\nÖrnek kargo ücreti ve ücretsiz kargo eşiği sepette hesaplanır. Hazırlık süresi örnektir. Bu açıklama panelden düzenlenebilir.",
  },
  {
    id: "iade",
    title: "İade ve iptal",
    body: "Bu demo gerçek satış veya ödeme oluşturmadığı için gerçek iade işlemi başlatmaz.\n\nBu alan, marka tarafından onaylanmış iade ve iptal koşulları için ayrılmıştır.",
  },
];
export const bannerDefault = {
  title: "Bazı anılar\nhep üzerinde\nkalsın.",
  description:
    "Bir fotoğraf. Bir his. Sadece sana ait bir parça.\nEn sevdiğin anı, ilmek ilmek yanında taşı.",
  buttonText: "Kendi hikâyeni tasarla",
  buttonLink: "#/urunler",
  image: "assets/hero.webp",
  visible: true,
};

export function normalizeContent(settings) {
  return {
    ...settings,
    banner: { ...bannerDefault, ...settings.banner },
    legalPages: legalDefaults.map((page) => ({
      ...page,
      ...settings.legalPages?.find((item) => item.id === page.id),
    })),
  };
}

export function validateContent(data, imageValidator) {
  const current = normalizeContent(data),
    banner = current.banner;
  if (
    typeof banner.title !== "string" ||
    !banner.title.trim() ||
    banner.title.length > 180 ||
    typeof banner.description !== "string" ||
    banner.description.length > 800 ||
    typeof banner.buttonText !== "string" ||
    !banner.buttonText.trim() ||
    banner.buttonText.length > 80 ||
    !/^#\/[a-zA-Z0-9_/-]*$/.test(banner.buttonLink) ||
    !imageValidator(banner.image)
  )
    throw new Error("Banner başlığını, butonunu ve görselini kontrol et.");
  for (const page of current.legalPages)
    if (
      typeof page.title !== "string" ||
      !page.title.trim() ||
      page.title.length > 100 ||
      typeof page.body !== "string" ||
      page.body.length > 20000
    )
      throw new Error(
        "Sayfa başlığı en fazla 100, metin en fazla 20.000 karakter olabilir.",
      );
  return current;
}
