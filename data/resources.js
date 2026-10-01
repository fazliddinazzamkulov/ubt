/* ============================================================
   САБАҚ РЕСУРСТАРЫ — бейне, қосымша материал, тапсырмалар
   ============================================================
   Кілт — сабақ нөмірі. Қай өріс бос болса, сайт оны әдемі
   «жақында қосылады» күйінде көрсетеді.

   window.RESOURCES.informatika[1] = {
     // YouTube, Google Drive сілтемесі немесе өз файлың: "assets/videos/01.mp4"
     video: "https://youtu.be/XXXXXXXXXXX",

     // Қосымша ресурстар. kind — қысқа белгі: PDF, Сайт, Файл, Бейне, Кесте...
     extra: [
       { title: "Сабақ конспектісі", url: "assets/files/01-konspekt.pdf", kind: "PDF" },
       { title: "Пайдалы сайт",       url: "https://example.com",          kind: "Сайт" }
     ],

     // Тапсырмалар. text мен url міндетті емес.
     tasks: [
       { title: "1-тапсырма", text: "Тапсырманың қысқа сипаттамасы", url: "" }
     ],

     // Тек осы сабаққа арнайы жіберу санаттары керек болса (міндетті емес):
     // categories: [ { id: "konspekt", icon: "notebook", title: "Конспект", hint: "..." } ]
   };
*/
window.RESOURCES = window.RESOURCES || {};

window.RESOURCES.informatika = {
  // 1: { video: "", extra: [], tasks: [] },
};
