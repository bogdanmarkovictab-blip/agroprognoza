// Podešavanja Agroprognoze.

// 1) Firebase, za prijavu korisnika.
// Dok je ovde null, dugme "Prijava" se ne prikazuje i parcele se čuvaju samo na uređaju.
// Ove vrednosti nisu tajne: Firebase ih javno koristi u pregledaču, a pristup podacima štite pravila iz firestore.rules.
window.AP_FIREBASE = null;

// 2) Google Weather API ključ (Google Cloud), za dodatni izvor "Google".
// Dok je ovde null, Google se ne prikazuje. Ključ OBAVEZNO ograniči u Google Cloud konzoli:
// samo na sajt bogdanmarkovictab-blip.github.io i samo na Weather API, uz dnevni limit poziva.
window.AP_GOOGLE_WEATHER_KEY = null;
