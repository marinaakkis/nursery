/** Атрибуция и привязка фотографий к растениям.
 *
 *  Ключ — латинское название растения, а не идентификатор строки в базе.
 *  Идентификатор нестабилен: он зависит от порядка вставки и от того, что
 *  происходило с таблицей раньше. Привязка по нему один раз уже разъехалась —
 *  разбор в memory/mistakes/2026-09-10-foto-privyazany-k-id.md.
 *
 *  Полная таблица с лицензиями — docs/photo-credits.md. Лицензии CC BY и CC BY-SA
 *  требуют указания автора, поэтому подпись едет вместе со снимком. */

export type PhotoCredit = { author: string; license: string; url: string };

/** Латинское название → файл и автор. Файл лежит в public/plants. */
const PHOTOS: Record<string, PhotoCredit & { file: string }> = {
  "Physocarpus opulifolius": { file: "physocarpus-opulifolius.jpg", author: "Jean-Pol GRANDMONT", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:0_Physocarpus_opulifolius_-_Samo%C3%ABns.JPG" },
  "Cornus alba": { file: "cornus-alba.jpg", author: "Sanja565658", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Swida_alba_01.jpg" },
  "Lonicera caerulea": { file: "lonicera-caerulea.jpg", author: "ИринаЯ", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:%D0%96%D0%B8%D0%BC%D0%BE%D0%BB%D0%BE%D1%81%D1%82%D1%8C_%D0%B3%D0%BE%D0%BB%D1%83%D0%B1%D0%B0%D1%8F_%D1%8F%D0%B3%D0%BE%D0%B4%D1%8B_%D0%A1%D0%B0%D1%80%D0%B0%D1%82%D0%BE%D0%B2.jpg" },
  "Amelanchier alnifolia": { file: "amelanchier-alnifolia.jpg", author: "Walter Siegmund (talk)", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Amelanchier_alnifolia_6338.JPG" },
  "Matteuccia struthiopteris": { file: "matteuccia-struthiopteris.jpg", author: "de:Benutzer:Griensteidl", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Matteuccia_struthiopteris_(4).JPG" },
  "Syringa vulgaris": { file: "syringa-vulgaris.jpg", author: "Georgi Kunev", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Syringa_vulgaris_Bulgaria_3.jpg" },
  "Hydrangea paniculata": { file: "hydrangea-paniculata.jpg", author: "Hedwig Storch", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hydrangea_paniculata_IMG_6629.JPG" },
  "Viburnum opulus": { file: "viburnum-opulus.jpg", author: "H. Zell", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Viburnum_opulus_001.JPG" },
  "Sorbus aucuparia": { file: "sorbus-aucuparia.jpg", author: "Baykedevries", license: "CC BY-SA 3.0 nl", url: "https://commons.wikimedia.org/wiki/File:Lijsterbes_op_het_Fochtelo%C3%ABrveen.jpg" },
  "Ribes nigrum": { file: "ribes-nigrum.jpg", author: "автор не указан", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Blackcurrant_1.jpg" },
  "Ribes uva-crispa": { file: "ribes-uva-crispa.jpg", author: "Rasbak", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Wilde_kruisbes_(Ribes_uva-crispa_wild_plant).jpg" },
  "Hosta fortunei": { file: "hosta-fortunei.jpg", author: "Epibase", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Hosta_sieboldiana_Elegans2UME.jpg" },
  "Brunnera macrophylla": { file: "brunnera-macrophylla.jpg", author: "Cephas", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Brunnera_macrophylla_JB.jpg" },
  "Paeonia lactiflora": { file: "paeonia-lactiflora.jpg", author: "KENPEI", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Paeonia_lactiflora1.jpg" },
  "Hemerocallis hybrida": { file: "hemerocallis-hybrida.jpg", author: "Jerzy Opioła", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hemerocallis_x_hybrida_a1.jpg" },
  "Rosa rugosa": { file: "rosa-rugosa.jpg", author: "Qwert1234", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Rosa_rugosa_Tokyo.JPG" },
  "Polygonatum multiflorum": { file: "polygonatum-multiflorum.jpg", author: "Dmitry Makeev", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:2020_year._Herbarium._Polygonatum_multiflorum._img-014.jpg" },
  "Spiraea japonica": { file: "spiraea-japonica.jpg", author: "Jean-Pol GRANDMONT", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:0_Spiraea_japonica_(2)_-_Yvoire.JPG" },
  "Philadelphus coronarius": { file: "philadelphus-coronarius.jpg", author: "NTNU Vitenskapsmuseet", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Ringve_botaniske_hage_foto-%C3%85ge_Hojem,_NTNU_Vitenskapsmuseet_dsc9291_(15100600617).jpg" },
  "Berberis thunbergii": { file: "berberis-thunbergii.jpg", author: "Opioła Jerzy (Poland)", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Berberis_thunbergii_%60Atropurpureum%60.jpg" },
  "Astilbe arendsii": { file: "astilbe-arendsii.jpg", author: "Sten Porse", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Astilbe-arendsii-total.JPG" },
  "Hosta plantaginea": { file: "hosta-plantaginea.jpg", author: "Stan Shebs", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hosta_plantaginea_cv_Royal_Standard_1.jpg" },
  "Heuchera hybrida": { file: "heuchera-hybrida.jpg", author: "David J. Stang", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Heuchera_micrantha_Palace_Purple_0zz.jpg" },
  "Phlox paniculata": { file: "phlox-paniculata.jpg", author: "Bernt Fransson", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:H%C3%B6stflox_001.jpg" },
  "Clematis jackmanii": { file: "clematis-jackmanii.jpg", author: "Ulf Eliasson", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Clematis_jackmannii1UME.jpg" },
  "Rhododendron ledebourii": { file: "rhododendron-ledebourii.jpg", author: "Roma643", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:%D0%A0%D0%BE%D0%B4%D0%BE%D0%B4%D0%B5%D0%BD%D0%B4%D1%80%D0%BE%D0%BD_%D0%9B%D0%B5%D0%B4%D0%B5%D0%B1%D1%83%D1%80%D0%B0_(Rhododendron_ledebourii_Pojark.).jpg" },
  "Weigela florida": { file: "weigela-florida.jpg", author: "Emőke Dénes", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Dipsacales_-_Weigela_florida_-_1.jpg" },
  "Buxus sempervirens": { file: "buxus-sempervirens.jpg", author: "автор не указан", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Buxus_sempervirens0.jpg" },
  "Lavandula angustifolia": { file: "lavandula-angustifolia.jpg", author: "Isiwal", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Vanessa_cardui_on_Lavandula_angustifolia-2459.jpg" },
  "Magnolia soulangeana": { file: "magnolia-soulangeana.jpg", author: "James F.", license: "CC BY 1.0", url: "https://commons.wikimedia.org/wiki/File:Magnolia_%C3%97_soulangeana_blossom.jpg" },
  "Bergenia crassifolia": { file: "bergenia-crassifolia.jpg", author: "Chris Light", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Bergenia_crassifolia_2066.jpg" },
};

/** Ключ нормализуется: пробелы и регистр в данных встречаются разные. */
const keyOf = (nameLat: string): string => nameLat.trim().replace(/\s+/g, " ");

/** Путь к снимку по латинскому названию. null — снимка нет, покажем подложку. */
export function photoPathFor(nameLat: string): string | null {
  const found = PHOTOS[keyOf(nameLat)];
  return found ? `/plants/${found.file}` : null;
}

export function photoCreditFor(nameLat: string): PhotoCredit | null {
  const found = PHOTOS[keyOf(nameLat)];
  return found ? { author: found.author, license: found.license, url: found.url } : null;
}

/** Все привязки — нужны сиду, чтобы записать photo_url в базу. */
export const ALL_PHOTOS = PHOTOS;

/** Снимки главной. Ключ смысловой, к таблице растений отношения не имеет. */
export const HOME_PHOTOS = {
  garden: { src: "/home/hero-garden.jpg", author: "C. G. P. Grey", license: "CC BY 3.0", url: "https://commons.wikimedia.org/wiki/File:Cutchogue_-_Oregon_Road_-_Plant_Nursery.jpg" },
  seedling: { src: "/home/hero-seedling.jpg", author: "USFS Region 5", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Seedling_planting.jpg" },
  greenhouse: { src: "/home/hero-greenhouse.jpg", author: "User:Владимир Иванов", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Botanical_Garden_V.L._Komarov_Botanical_Institute.jpg" },
} as const;
