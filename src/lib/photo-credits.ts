/** Атрибуция фотографий. Файл сгенерирован скриптом загрузки с Wikimedia Commons;
 *  полная таблица с лицензиями — docs/photo-credits.md. Лицензии CC BY и CC BY-SA
 *  требуют указания автора, поэтому подпись едет вместе со снимком, а не только в доке. */

export type PhotoCredit = { author: string; license: string; url: string };

const CREDITS: Record<number, PhotoCredit> = {
  1: { author: "Jean-Pol GRANDMONT", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:0_Physocarpus_opulifolius_-_Samo%C3%ABns.JPG" },
  2: { author: "Sanja565658", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Swida_alba_01.jpg" },
  3: { author: "ИринаЯ", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:%D0%96%D0%B8%D0%BC%D0%BE%D0%BB%D0%BE%D1%81%D1%82%D1%8C_%D0%B3%D0%BE%D0%BB%D1%83%D0%B1%D0%B0%D1%8F_%D1%8F%D0%B3%D0%BE%D0%B4%D1%8B_%D0%A1%D0%B0%D1%80%D0%B0%D1%82%D0%BE%D0%B2.jpg" },
  4: { author: "Walter Siegmund (talk)", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Amelanchier_alnifolia_6338.JPG" },
  5: { author: "de:Benutzer:Griensteidl", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Matteuccia_struthiopteris_(4).JPG" },
  6: { author: "Georgi Kunev", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Syringa_vulgaris_Bulgaria_3.jpg" },
  7: { author: "Hedwig Storch", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hydrangea_paniculata_IMG_6629.JPG" },
  8: { author: "H. Zell", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Viburnum_opulus_001.JPG" },
  9: { author: "Baykedevries", license: "CC BY-SA 3.0 nl", url: "https://commons.wikimedia.org/wiki/File:Lijsterbes_op_het_Fochtelo%C3%ABrveen.jpg" },
  10: { author: "автор не указан", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Blackcurrant_1.jpg" },
  11: { author: "Rasbak", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Wilde_kruisbes_(Ribes_uva-crispa_wild_plant).jpg" },
  12: { author: "Epibase", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Hosta_sieboldiana_Elegans2UME.jpg" },
  13: { author: "Cephas", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Brunnera_macrophylla_JB.jpg" },
  14: { author: "KENPEI", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Paeonia_lactiflora1.jpg" },
  15: { author: "Jerzy Opioła", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hemerocallis_x_hybrida_a1.jpg" },
  16: { author: "Qwert1234", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Rosa_rugosa_Tokyo.JPG" },
  17: { author: "Dmitry Makeev", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:2020_year._Herbarium._Polygonatum_multiflorum._img-014.jpg" },
  18: { author: "Jean-Pol GRANDMONT", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:0_Spiraea_japonica_(2)_-_Yvoire.JPG" },
  19: { author: "NTNU Vitenskapsmuseet", license: "CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:Ringve_botaniske_hage_foto-%C3%85ge_Hojem,_NTNU_Vitenskapsmuseet_dsc9291_(15100600617).jpg" },
  20: { author: "Opioła Jerzy (Poland)", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Berberis_thunbergii_%60Atropurpureum%60.jpg" },
  21: { author: "Sten Porse", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Astilbe-arendsii-total.JPG" },
  22: { author: "Stan Shebs", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Hosta_plantaginea_cv_Royal_Standard_1.jpg" },
  23: { author: "Henry A. Dreer (Firm); Henry G. Gilbert Nursery and Seed Trade Catalog Collection.", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Dreer%27s_wholesale_price_list_autumn_edition_September_to_December_1900_(16443179231).jpg" },
  24: { author: "Bernt Fransson", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:H%C3%B6stflox_001.jpg" },
  25: { author: "Ulf Eliasson", license: "CC BY 2.5", url: "https://commons.wikimedia.org/wiki/File:Clematis_jackmannii1UME.jpg" },
  26: { author: "Roma643", license: "CC0", url: "https://commons.wikimedia.org/wiki/File:%D0%A0%D0%BE%D0%B4%D0%BE%D0%B4%D0%B5%D0%BD%D0%B4%D1%80%D0%BE%D0%BD_%D0%9B%D0%B5%D0%B4%D0%B5%D0%B1%D1%83%D1%80%D0%B0_(Rhododendron_ledebourii_Pojark.).jpg" },
  27: { author: "Emőke Dénes", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Dipsacales_-_Weigela_florida_-_1.jpg" },
  28: { author: "автор не указан", license: "CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Buxus_sempervirens0.jpg" },
  29: { author: "Isiwal", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Vanessa_cardui_on_Lavandula_angustifolia-2459.jpg" },
  30: { author: "James F.", license: "CC BY 1.0", url: "https://commons.wikimedia.org/wiki/File:Magnolia_%C3%97_soulangeana_blossom.jpg" },
};

/** Путь к снимку растения или null, если снимка нет — тогда рисуется заглушка. */
export function plantPhoto(plantId: number): string | null {
  return CREDITS[plantId] ? `/plants/${plantId}.jpg` : null;
}

export function plantPhotoCredit(plantId: number): PhotoCredit | null {
  return CREDITS[plantId] ?? null;
}

export const HOME_PHOTOS = {
  garden: { src: "/home/hero-garden.jpg", author: "Currie Brothers Company.; Henry G. Gilbert Nursery and Seed Trade Catalog Collection.", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Bulbs_and_plants_(16387437412).jpg" },
  seedling: { src: "/home/hero-seedling.jpg", author: "Robbieross123", license: "CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Plant_a_Sapling_for_Better_Future.jpg" },
  greenhouse: { src: "/home/hero-greenhouse.jpg", author: "Joshua Tree National Park", license: "Public domain", url: "https://commons.wikimedia.org/wiki/File:Native_Plant_Nursery_(53728476572).jpg" },
} as const;
