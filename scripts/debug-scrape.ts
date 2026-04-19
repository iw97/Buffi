import { scrapeProductFromUrl } from "../src/lib/scan/scrape";

const URLS = [
  "https://www.thereformation.com/products/stelliana-silk-dress/1319958BAD.html?dwvar_1319958BAD_color=BAD",
  "https://www.miumiu.com/us/en/p/denim-miniskirt/GWD329_143V_F0008_S_OOO?utm_campaign=GoogleShopping_US&utm_medium=CPC&utm_source=Google&utm_content=PMax&s_kwcid=AL!8549!3!!!!x!!&gclsrc=aw.ds&gad_source=1&gad_campaignid=19547632285&gbraid=0AAAAADjs5160XFCXFVvEJxbJn9X6nNtTH&gclid=Cj0KCQjwqPLOBhCiARIsAKRMPZprX8hAW9dQOGQcTXq6ZWjkw3HrWB32WGF_2G_Jft3lIgDwv6ysvM4aAgUnEALw_wcB",
  "https://m.shein.com/us/NcmRyu-Women-s-Dance-Casual-Sports-Fitness-Sweet-Short-Sleeve-Butt-Lifting-Shorts-Activewear-Set-p-73421694.html?attr_ids=&detailBusinessFrom=0-1_73421694%257C0-2&imgRatio=3-4&isAppointMall=&mallCode=1&pageListType=4&showFeedbackRec=1&src_identifier=on%253DCATEGORY_RECOMMEND_COMPONENT%2560cn%253Dsbc%2560hz%253D-%2560jc%253Dreal_3195%2560ps%253D3_2_5&src_module=all&src_tab_page_id=page_home1776539000949"
];

async function main(): Promise<void> {
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log("\n\n========== debug-scrape", i + 1, "/", URLS.length, "==========\n", url, "\n");
    const result = await scrapeProductFromUrl(url);
    console.log("\n--- scrapeProductFromUrl return ---\n", JSON.stringify(result, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
