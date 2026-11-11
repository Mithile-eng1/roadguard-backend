// Tiny i18n: English, Tamil, Hindi. t('key', {var}) falls back to English, then to the key itself.
// Covers the navigation, sign-in, reporting, drive mode and the new route tools. Long explanatory
// text (About page, how-it-works) is still English only.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const EN = {
  'nav.home': 'Home', 'nav.history': 'History', 'nav.about': 'About', 'nav.myReports': 'My reports', 'nav.admin': 'Admin',
  'nav.login': 'Log in', 'nav.logout': 'Log out', 'nav.language': 'Language',
  'auth.login': 'Log in', 'auth.signup': 'Create account', 'auth.forgot': 'Forgot password', 'auth.reset': 'Choose a new password',
  'auth.name': 'Name', 'auth.email': 'Email', 'auth.password': 'Password', 'auth.newPassword': 'New password (8+ characters)',
  'auth.passwordNew': 'Password (8+ characters)', 'auth.forgotLink': 'Forgot password?', 'auth.newHere': 'New here? Create an account',
  'auth.haveAccount': 'Have an account? Log in', 'auth.cancel': 'Cancel', 'auth.back': 'Back to log in', 'auth.sendLink': 'Send reset link',
  'auth.saveNew': 'Save new password', 'auth.wait': 'Please wait…',
  'auth.http': '⚠ This demo link is not encrypted (HTTP). Use a throwaway password you do not use anywhere else.',
  'auth.loginToContinue': 'Log in to continue.', 'auth.forgotHelp': 'Enter your account email and we will send a reset link.',
  'report.title': 'Report a road hazard', 'report.back': 'Back', 'report.gps': 'Use my current location', 'report.place': 'Choose another place',
  'report.search': 'Search a place or address', 'report.pothole': 'Pothole', 'report.speedbreaker': 'Speed breaker',
  'report.note': 'Note (optional)', 'report.addPhoto': 'Add photo', 'report.changePhoto': 'Change photo', 'report.submit': 'Submit report',
  'report.pick': 'Pick a location to see Street View',
  'map.reportBtn': '⚠ Report hazard',
  'set.title': 'Settings', 'set.sec.look': 'Language & appearance', 'set.sec.drive': 'Driving & alerts', 'set.sec.account': 'Account', 'set.sec.app': 'App', 'set.sec.data': 'Your data on this device', 'set.sec.conn': 'Connection',
  'set.language': 'Language', 'set.dark': 'Dark mode', 'set.textSize': 'Text size', 'set.size.normal': 'Normal', 'set.size.large': 'Large', 'set.size.xl': 'Extra large',
  'set.voice': 'Voice warnings', 'set.voiceHelp': 'Speak hazard warnings aloud in drive mode.', 'set.warnDist': 'Warn me this far ahead',
  'set.bump': 'Bump detection', 'set.bumpHelp': 'After a jolt while driving, ask "did you hit a bump?" Needs motion sensor permission.',
  'set.sens': 'Bump sensitivity', 'set.sens.low': 'Low', 'set.sens.normal': 'Normal', 'set.sens.high': 'High',
  'set.notLoggedIn': 'You are not logged in.', 'set.verified': 'Email verified', 'set.unverified': 'Email not verified',
  'set.install': 'Install RoadGuard on this device', 'set.installed': 'Installed as an app', 'set.installHint': 'Use your browser menu: "Install app" or "Add to Home screen". Works on secure (HTTPS) sites.',
  'set.clearHistory': 'Clear route history ({n})', 'set.confirmClear': 'Delete all saved routes on this device?', 'set.resetAll': 'Reset all settings', 'set.confirmReset': 'Reset every setting to its default?',
  'set.saveConn': 'Save connection', 'set.saved': 'Saved', 'set.useServer': 'Use the analysis server', 'set.serverUrl': 'Server URL', 'set.test': 'Test',
  'map.myLocation': '📍 My location', 'map.following': '📍 Following you', 'map.recenter': '📍 Recenter', 'map.youAreHere': 'You are here',
  'map.gpsDenied': 'Location permission refused or unavailable. Allow location access in your browser settings.', 'drive.left': '{km} km left',
  'vote.see': '👍 I see this too', 'vote.fixed': "✔ It's fixed", 'vote.thanks': 'Thanks, noted', 'vote.thanksFixed': 'Thanks, marked as fixed',
  'vote.confirmed': 'Confirmed by {n} users', 'vote.needed': '{n} of {k} reports needed to confirm',
  'hero.plan': 'Plan a route', 'hero.from': 'From', 'hero.to': 'To', 'hero.swap': 'Swap', 'hero.placeholder': 'Place, landmark, or lat,lng',
  'hero.pick': 'Pick points on a map instead', 'hero.vehicle': 'Vehicle', 'hero.analyze': 'Analyze route',
  'res.title': 'Results', 'res.report': 'Report', 'res.share': 'Share', 'res.copied': 'Link copied', 'res.recommended': 'Recommended',
  'res.hazards': '{n} hazards', 'res.risk': 'Risk {n}', 'res.drive': 'Drive mode',
  'pref.title': 'Fastest ↔ Safest', 'pref.fastest': 'Fastest', 'pref.safest': 'Safest', 'pref.same': 'This is also the fastest route.',
  'pref.tradeoff': '+{min} min vs the fastest · risk {drop} points lower',
  'cov.note': '{pct}% of this route has Street View coverage. {n} stretch(es) were not scanned (dashed on the map): hazards there are unknown, not absent.',
  'cov.legend': 'Not scanned',
  'age.line': 'Street View image: {date}', 'age.old': '{n} years old, may be out of date',
  'age.hidden': '{n} hazard(s) hidden: drivers reported them fixed since the image was taken.',
  'drive.title': 'Drive mode', 'drive.start': 'Start', 'drive.stop': 'Stop', 'drive.voice': 'Voice warnings', 'drive.speed': 'Speed',
  'drive.kmh': 'km/h', 'drive.nextNone': 'No hazards ahead', 'drive.offRoute': 'You are off the route',
  'drive.ahead': '{type} in {m} m. Slow to {v} km/h.', 'drive.now': '{type} ahead. Slow to {v} km/h.', 'drive.gps': 'Waiting for GPS…',
  'drive.sensor': 'Bump detection is on', 'drive.sensorDenied': 'Motion sensor permission was refused, so bump prompts are off. Allow it in your browser settings and press Start again.', 'drive.noSensor': 'Bump detection is not available on this device.',
  'drive.bump': 'Did you just hit a bump?', 'drive.bumpSb': 'Speed breaker', 'drive.bumpPh': 'Pothole', 'drive.bumpNone': 'Nothing',
  'drive.needLogin': 'Log in with a verified email to send a report.', 'drive.sent': 'Report sent, thank you', 'drive.close': 'Close',
  'drive.safety': 'Keep your eyes on the road. This screen is a helper, not a guarantee.', 'drive.hazards': 'Hazards on route',
  'drive.noRoute': 'Analyse a route first, then open drive mode.',
  'type.pothole': 'pothole', 'type.speedbreaker': 'speed breaker',
  'sev.High': 'high', 'sev.Medium': 'medium', 'sev.Low': 'low',
  'authority.btn': 'Report to authorities', 'authority.title': 'Report road hazards to the authorities', 'authority.to': 'To',
  'authority.toDefault': 'The Municipal Commissioner / Highways Department', 'authority.subject': 'Road hazards on the route {from} to {to}',
  'authority.intro': 'Sir/Madam,\n\nI am writing to report road hazards on the route {from} to {to}. Each hazard is listed below with its location and how it was found. Kindly arrange inspection and repair.',
  'authority.row': '{n}. {type} ({sev} risk) at {where} - {src}',
  'authority.srcDetected': 'found automatically in a Street View image ({date})', 'authority.srcCrowd': 'reported and confirmed by {n} drivers',
  'authority.closing': 'Thank you.\n\nSent using RoadGuard.', 'authority.none': 'There are no hazards on this route to report.',
  'authority.copy': 'Copy text', 'authority.copied': 'Copied', 'authority.email': 'Open in email', 'authority.print': 'Print / save as PDF',
  'authority.map': 'map',
};

const HI = {
  'nav.home': 'होम', 'nav.history': 'इतिहास', 'nav.about': 'परिचय', 'nav.myReports': 'मेरी रिपोर्ट', 'nav.admin': 'एडमिन',
  'nav.login': 'लॉग इन', 'nav.logout': 'लॉग आउट', 'nav.language': 'भाषा',
  'auth.login': 'लॉग इन', 'auth.signup': 'खाता बनाएँ', 'auth.forgot': 'पासवर्ड भूल गए', 'auth.reset': 'नया पासवर्ड चुनें',
  'auth.name': 'नाम', 'auth.email': 'ईमेल', 'auth.password': 'पासवर्ड', 'auth.newPassword': 'नया पासवर्ड (8+ अक्षर)',
  'auth.passwordNew': 'पासवर्ड (8+ अक्षर)', 'auth.forgotLink': 'पासवर्ड भूल गए?', 'auth.newHere': 'नए हैं? खाता बनाएँ',
  'auth.haveAccount': 'खाता है? लॉग इन करें', 'auth.cancel': 'रद्द करें', 'auth.back': 'लॉग इन पर वापस', 'auth.sendLink': 'रीसेट लिंक भेजें',
  'auth.saveNew': 'नया पासवर्ड सहेजें', 'auth.wait': 'कृपया प्रतीक्षा करें…',
  'auth.http': '⚠ यह डेमो लिंक एन्क्रिप्टेड नहीं है (HTTP)। ऐसा अस्थायी पासवर्ड रखें जो आप कहीं और इस्तेमाल नहीं करते।',
  'auth.loginToContinue': 'जारी रखने के लिए लॉग इन करें।', 'auth.forgotHelp': 'अपने खाते का ईमेल दर्ज करें, हम रीसेट लिंक भेजेंगे।',
  'report.title': 'सड़क के खतरे की रिपोर्ट करें', 'report.back': 'वापस', 'report.gps': 'मेरी वर्तमान लोकेशन उपयोग करें', 'report.place': 'कोई दूसरी जगह चुनें',
  'report.search': 'जगह या पता खोजें', 'report.pothole': 'गड्ढा', 'report.speedbreaker': 'स्पीड ब्रेकर',
  'report.note': 'टिप्पणी (वैकल्पिक)', 'report.addPhoto': 'फोटो जोड़ें', 'report.changePhoto': 'फोटो बदलें', 'report.submit': 'रिपोर्ट भेजें',
  'report.pick': 'स्ट्रीट व्यू देखने के लिए जगह चुनें',
  'map.reportBtn': '⚠ खतरा रिपोर्ट करें',
  'set.title': 'सेटिंग्स', 'set.sec.look': 'भाषा और रूप', 'set.sec.drive': 'ड्राइविंग और अलर्ट', 'set.sec.account': 'खाता', 'set.sec.app': 'ऐप', 'set.sec.data': 'इस डिवाइस पर आपका डेटा', 'set.sec.conn': 'कनेक्शन',
  'set.language': 'भाषा', 'set.dark': 'डार्क मोड', 'set.textSize': 'टेक्स्ट का आकार', 'set.size.normal': 'सामान्य', 'set.size.large': 'बड़ा', 'set.size.xl': 'बहुत बड़ा',
  'set.voice': 'आवाज़ी चेतावनी', 'set.voiceHelp': 'ड्राइव मोड में खतरे की चेतावनी बोलकर सुनाएँ।', 'set.warnDist': 'इतनी दूरी पहले चेतावनी दें',
  'set.bump': 'झटका पहचान', 'set.bumpHelp': 'ड्राइविंग में झटका लगने पर पूछें "क्या आपको झटका लगा?" इसके लिए मोशन सेंसर की अनुमति चाहिए।',
  'set.sens': 'झटके की संवेदनशीलता', 'set.sens.low': 'कम', 'set.sens.normal': 'सामान्य', 'set.sens.high': 'अधिक',
  'set.notLoggedIn': 'आप लॉग इन नहीं हैं।', 'set.verified': 'ईमेल सत्यापित', 'set.unverified': 'ईमेल सत्यापित नहीं',
  'set.install': 'इस डिवाइस पर RoadGuard इंस्टॉल करें', 'set.installed': 'ऐप के रूप में इंस्टॉल है', 'set.installHint': 'ब्राउज़र मेन्यू में "Install app" या "Add to Home screen" चुनें। यह सुरक्षित (HTTPS) साइट पर काम करता है।',
  'set.clearHistory': 'रूट इतिहास साफ़ करें ({n})', 'set.confirmClear': 'इस डिवाइस पर सहेजे सभी रूट मिटाएँ?', 'set.resetAll': 'सभी सेटिंग्स रीसेट करें', 'set.confirmReset': 'हर सेटिंग को डिफ़ॉल्ट पर लौटाएँ?',
  'set.saveConn': 'कनेक्शन सहेजें', 'set.saved': 'सहेजा गया', 'set.useServer': 'विश्लेषण सर्वर का उपयोग करें', 'set.serverUrl': 'सर्वर URL', 'set.test': 'जाँचें',
  'map.myLocation': '📍 मेरी लोकेशन', 'map.following': '📍 आपको फ़ॉलो कर रहा है', 'map.recenter': '📍 केंद्र में लाएँ', 'map.youAreHere': 'आप यहाँ हैं',
  'map.gpsDenied': 'लोकेशन की अनुमति नहीं मिली या उपलब्ध नहीं है। ब्राउज़र सेटिंग में लोकेशन की अनुमति दें।', 'drive.left': '{km} किमी बाकी',
  'vote.see': '👍 मैंने भी देखा', 'vote.fixed': '✔ यह ठीक हो चुका है', 'vote.thanks': 'धन्यवाद, दर्ज हो गया', 'vote.thanksFixed': 'धन्यवाद, ठीक हुआ चिह्नित किया',
  'vote.confirmed': '{n} उपयोगकर्ताओं ने पुष्टि की', 'vote.needed': 'पुष्टि के लिए {k} में से {n} रिपोर्ट',
  'hero.plan': 'रूट प्लान करें', 'hero.from': 'कहाँ से', 'hero.to': 'कहाँ तक', 'hero.swap': 'अदला-बदली', 'hero.placeholder': 'जगह, लैंडमार्क, या lat,lng',
  'hero.pick': 'इसके बजाय नक्शे पर बिंदु चुनें', 'hero.vehicle': 'वाहन', 'hero.analyze': 'रूट जाँचें',
  'res.title': 'परिणाम', 'res.report': 'रिपोर्ट', 'res.share': 'साझा करें', 'res.copied': 'लिंक कॉपी हुआ', 'res.recommended': 'सुझाया गया',
  'res.hazards': '{n} खतरे', 'res.risk': 'जोखिम {n}', 'res.drive': 'ड्राइव मोड',
  'pref.title': 'सबसे तेज़ ↔ सबसे सुरक्षित', 'pref.fastest': 'सबसे तेज़', 'pref.safest': 'सबसे सुरक्षित', 'pref.same': 'यही सबसे तेज़ रूट भी है।',
  'pref.tradeoff': 'सबसे तेज़ से +{min} मिनट · जोखिम {drop} अंक कम',
  'cov.note': 'इस रूट के {pct}% हिस्से पर स्ट्रीट व्यू उपलब्ध था। {n} हिस्से स्कैन नहीं हुए (नक्शे पर धारीदार): वहाँ खतरे अज्ञात हैं, यह नहीं कि हैं ही नहीं।',
  'cov.legend': 'स्कैन नहीं हुआ',
  'age.line': 'स्ट्रीट व्यू तस्वीर: {date}', 'age.old': '{n} साल पुरानी, अब बदल चुकी हो सकती है',
  'age.hidden': '{n} खतरे छिपाए गए: तस्वीर के बाद चालकों ने उन्हें ठीक बताया।',
  'drive.title': 'ड्राइव मोड', 'drive.start': 'शुरू करें', 'drive.stop': 'रोकें', 'drive.voice': 'आवाज़ी चेतावनी', 'drive.speed': 'गति',
  'drive.kmh': 'किमी/घं', 'drive.nextNone': 'आगे कोई खतरा नहीं', 'drive.offRoute': 'आप रूट से बाहर हैं',
  'drive.ahead': '{m} मीटर आगे {type}। गति {v} किमी/घं तक कम करें।', 'drive.now': 'आगे {type}। गति {v} किमी/घं तक कम करें।', 'drive.gps': 'GPS की प्रतीक्षा…',
  'drive.sensor': 'झटका पहचान चालू है', 'drive.sensorDenied': 'मोशन सेंसर की अनुमति नहीं दी गई, इसलिए झटके के प्रश्न बंद हैं। ब्राउज़र सेटिंग में अनुमति दें और फिर शुरू करें दबाएँ।', 'drive.noSensor': 'इस डिवाइस पर झटका पहचान उपलब्ध नहीं है।',
  'drive.bump': 'क्या अभी झटका लगा?', 'drive.bumpSb': 'स्पीड ब्रेकर', 'drive.bumpPh': 'गड्ढा', 'drive.bumpNone': 'कुछ नहीं',
  'drive.needLogin': 'रिपोर्ट भेजने के लिए सत्यापित ईमेल से लॉग इन करें।', 'drive.sent': 'रिपोर्ट भेज दी गई, धन्यवाद', 'drive.close': 'बंद करें',
  'drive.safety': 'नज़र सड़क पर रखें। यह स्क्रीन सहायक है, गारंटी नहीं।', 'drive.hazards': 'रूट पर खतरे',
  'drive.noRoute': 'पहले कोई रूट जाँचें, फिर ड्राइव मोड खोलें।',
  'type.pothole': 'गड्ढा', 'type.speedbreaker': 'स्पीड ब्रेकर',
  'sev.High': 'उच्च', 'sev.Medium': 'मध्यम', 'sev.Low': 'कम',
  'authority.btn': 'अधिकारियों को रिपोर्ट करें', 'authority.title': 'सड़क के खतरों की अधिकारियों को रिपोर्ट', 'authority.to': 'प्रति',
  'authority.toDefault': 'नगर आयुक्त / राजमार्ग विभाग', 'authority.subject': '{from} से {to} मार्ग पर सड़क के खतरे',
  'authority.intro': 'महोदय/महोदया,\n\nमैं {from} से {to} मार्ग पर सड़क के खतरों की सूचना दे रहा/रही हूँ। हर खतरा नीचे उसकी जगह और पहचान के तरीके के साथ दिया गया है। कृपया निरीक्षण और मरम्मत करवाएँ।',
  'authority.row': '{n}. {type} ({sev} जोखिम), स्थान {where} - {src}',
  'authority.srcDetected': 'स्ट्रीट व्यू तस्वीर ({date}) में अपने-आप मिला', 'authority.srcCrowd': '{n} चालकों ने रिपोर्ट कर पुष्टि की',
  'authority.closing': 'धन्यवाद।\n\nRoadGuard से भेजा गया।', 'authority.none': 'इस रूट पर रिपोर्ट करने लायक कोई खतरा नहीं है।',
  'authority.copy': 'टेक्स्ट कॉपी करें', 'authority.copied': 'कॉपी हुआ', 'authority.email': 'ईमेल में खोलें', 'authority.print': 'प्रिंट / PDF सहेजें',
  'authority.map': 'नक्शा',
};

const TA = {
  'nav.home': 'முகப்பு', 'nav.history': 'வரலாறு', 'nav.about': 'பற்றி', 'nav.myReports': 'என் புகார்கள்', 'nav.admin': 'நிர்வாகி',
  'nav.login': 'உள்நுழை', 'nav.logout': 'வெளியேறு', 'nav.language': 'மொழி',
  'auth.login': 'உள்நுழை', 'auth.signup': 'கணக்கு உருவாக்கு', 'auth.forgot': 'கடவுச்சொல் மறந்துவிட்டது', 'auth.reset': 'புதிய கடவுச்சொல்லைத் தேர்வு செய்க',
  'auth.name': 'பெயர்', 'auth.email': 'மின்னஞ்சல்', 'auth.password': 'கடவுச்சொல்', 'auth.newPassword': 'புதிய கடவுச்சொல் (8+ எழுத்துகள்)',
  'auth.passwordNew': 'கடவுச்சொல் (8+ எழுத்துகள்)', 'auth.forgotLink': 'கடவுச்சொல் மறந்துவிட்டதா?', 'auth.newHere': 'புதியவரா? கணக்கு உருவாக்குங்கள்',
  'auth.haveAccount': 'கணக்கு உள்ளதா? உள்நுழையுங்கள்', 'auth.cancel': 'ரத்து', 'auth.back': 'உள்நுழைவுக்குத் திரும்பு', 'auth.sendLink': 'மீட்டமை இணைப்பை அனுப்பு',
  'auth.saveNew': 'புதிய கடவுச்சொல்லைச் சேமி', 'auth.wait': 'தயவுசெய்து காத்திருங்கள்…',
  'auth.http': '⚠ இந்த டெமோ இணைப்பு குறியாக்கம் செய்யப்படவில்லை (HTTP). வேறு எங்கும் பயன்படுத்தாத தற்காலிக கடவுச்சொல்லைப் பயன்படுத்துங்கள்.',
  'auth.loginToContinue': 'தொடர உள்நுழையுங்கள்.', 'auth.forgotHelp': 'உங்கள் கணக்கின் மின்னஞ்சலை உள்ளிடுங்கள்; மீட்டமை இணைப்பை அனுப்புவோம்.',
  'report.title': 'சாலை ஆபத்தைப் புகாரளி', 'report.back': 'பின்', 'report.gps': 'என் தற்போதைய இடத்தைப் பயன்படுத்து', 'report.place': 'வேறு இடத்தைத் தேர்ந்தெடு',
  'report.search': 'இடம் அல்லது முகவரியைத் தேடுங்கள்', 'report.pothole': 'குழி', 'report.speedbreaker': 'வேகத்தடை',
  'report.note': 'குறிப்பு (விருப்பம்)', 'report.addPhoto': 'புகைப்படம் சேர்', 'report.changePhoto': 'புகைப்படத்தை மாற்று', 'report.submit': 'புகாரை அனுப்பு',
  'report.pick': 'ஸ்ட்ரீட் வியூ பார்க்க ஓர் இடத்தைத் தேர்ந்தெடுங்கள்',
  'map.reportBtn': '⚠ ஆபத்தைப் புகாரளி',
  'set.title': 'அமைப்புகள்', 'set.sec.look': 'மொழி மற்றும் தோற்றம்', 'set.sec.drive': 'ஓட்டுதல் மற்றும் எச்சரிக்கைகள்', 'set.sec.account': 'கணக்கு', 'set.sec.app': 'செயலி', 'set.sec.data': 'இந்தச் சாதனத்தில் உங்கள் தரவு', 'set.sec.conn': 'இணைப்பு',
  'set.language': 'மொழி', 'set.dark': 'இருள் பயன்முறை', 'set.textSize': 'எழுத்து அளவு', 'set.size.normal': 'சாதாரணம்', 'set.size.large': 'பெரியது', 'set.size.xl': 'மிகப் பெரியது',
  'set.voice': 'குரல் எச்சரிக்கைகள்', 'set.voiceHelp': 'ஓட்டுநர் பயன்முறையில் ஆபத்து எச்சரிக்கைகளைக் குரலில் சொல்லவும்.', 'set.warnDist': 'இவ்வளவு தூரத்துக்கு முன் எச்சரிக்கவும்',
  'set.bump': 'குலுக்கல் கண்டறிதல்', 'set.bumpHelp': 'ஓட்டும்போது குலுங்கினால் "குலுங்கியதா?" எனக் கேட்கும். இயக்க உணரி அனுமதி தேவை.',
  'set.sens': 'குலுக்கல் உணர்திறன்', 'set.sens.low': 'குறைவு', 'set.sens.normal': 'சாதாரணம்', 'set.sens.high': 'அதிகம்',
  'set.notLoggedIn': 'நீங்கள் உள்நுழையவில்லை.', 'set.verified': 'மின்னஞ்சல் சரிபார்க்கப்பட்டது', 'set.unverified': 'மின்னஞ்சல் சரிபார்க்கப்படவில்லை',
  'set.install': 'இந்தச் சாதனத்தில் RoadGuard ஐ நிறுவு', 'set.installed': 'செயலியாக நிறுவப்பட்டுள்ளது', 'set.installHint': 'உலாவி மெனுவில் "Install app" அல்லது "Add to Home screen" தேர்ந்தெடுக்கவும். பாதுகாப்பான (HTTPS) தளங்களில் வேலை செய்யும்.',
  'set.clearHistory': 'பாதை வரலாற்றை அழி ({n})', 'set.confirmClear': 'இந்தச் சாதனத்தில் சேமித்த எல்லா பாதைகளையும் நீக்கவா?', 'set.resetAll': 'எல்லா அமைப்புகளையும் மீட்டமை', 'set.confirmReset': 'ஒவ்வொரு அமைப்பையும் இயல்புநிலைக்கு மாற்றவா?',
  'set.saveConn': 'இணைப்பைச் சேமி', 'set.saved': 'சேமிக்கப்பட்டது', 'set.useServer': 'பகுப்பாய்வு சேவையகத்தைப் பயன்படுத்து', 'set.serverUrl': 'சேவையகம் URL', 'set.test': 'சோதி',
  'map.myLocation': '📍 என் இடம்', 'map.following': '📍 உங்களைப் பின்தொடர்கிறது', 'map.recenter': '📍 மையப்படுத்து', 'map.youAreHere': 'நீங்கள் இங்கே இருக்கிறீர்கள்',
  'map.gpsDenied': 'இட அனுமதி மறுக்கப்பட்டது அல்லது கிடைக்கவில்லை. உலாவி அமைப்புகளில் இட அணுகலை அனுமதியுங்கள்.', 'drive.left': '{km} கிமீ மீதம்',
  'vote.see': '👍 நானும் பார்த்தேன்', 'vote.fixed': '✔ சரி செய்யப்பட்டுவிட்டது', 'vote.thanks': 'நன்றி, பதிவு செய்யப்பட்டது', 'vote.thanksFixed': 'நன்றி, சரிசெய்யப்பட்டதாகக் குறிக்கப்பட்டது',
  'vote.confirmed': '{n} பயனர்கள் உறுதிப்படுத்தினர்', 'vote.needed': 'உறுதிப்படுத்த {k} இல் {n} புகார்கள்',
  'hero.plan': 'பாதையைத் திட்டமிடு', 'hero.from': 'தொடக்கம்', 'hero.to': 'சேருமிடம்', 'hero.swap': 'மாற்று', 'hero.placeholder': 'இடம், அடையாளம், அல்லது lat,lng',
  'hero.pick': 'அதற்குப் பதில் வரைபடத்தில் புள்ளிகளைத் தேர்வு செய்', 'hero.vehicle': 'வாகனம்', 'hero.analyze': 'பாதையைச் சோதி',
  'res.title': 'முடிவுகள்', 'res.report': 'அறிக்கை', 'res.share': 'பகிர்', 'res.copied': 'இணைப்பு நகலெடுக்கப்பட்டது', 'res.recommended': 'பரிந்துரை',
  'res.hazards': '{n} ஆபத்துகள்', 'res.risk': 'ஆபத்து {n}', 'res.drive': 'ஓட்டுநர் பயன்முறை',
  'pref.title': 'வேகமான ↔ பாதுகாப்பான', 'pref.fastest': 'வேகமான', 'pref.safest': 'பாதுகாப்பான', 'pref.same': 'இதுவே வேகமான பாதையும் ஆகும்.',
  'pref.tradeoff': 'வேகமானதை விட +{min} நிமிடம் · ஆபத்து {drop} புள்ளிகள் குறைவு',
  'cov.note': 'இந்தப் பாதையின் {pct}% பகுதிக்கு ஸ்ட்ரீட் வியூ இருந்தது. {n} பகுதிகள் ஸ்கேன் செய்யப்படவில்லை (வரைபடத்தில் கோடிட்டவை): அங்கு ஆபத்துகள் தெரியாது, இல்லை என்று அர்த்தமல்ல.',
  'cov.legend': 'ஸ்கேன் செய்யப்படவில்லை',
  'age.line': 'ஸ்ட்ரீட் வியூ படம்: {date}', 'age.old': '{n} ஆண்டுகள் பழையது, இப்போது மாறியிருக்கலாம்',
  'age.hidden': '{n} ஆபத்துகள் மறைக்கப்பட்டன: படம் எடுத்த பிறகு ஓட்டுநர்கள் அவற்றைச் சரிசெய்யப்பட்டதாகத் தெரிவித்தனர்.',
  'drive.title': 'ஓட்டுநர் பயன்முறை', 'drive.start': 'தொடங்கு', 'drive.stop': 'நிறுத்து', 'drive.voice': 'குரல் எச்சரிக்கைகள்', 'drive.speed': 'வேகம்',
  'drive.kmh': 'கிமீ/ம', 'drive.nextNone': 'முன்னால் ஆபத்து இல்லை', 'drive.offRoute': 'நீங்கள் பாதையை விட்டு விலகிவிட்டீர்கள்',
  'drive.ahead': '{m} மீட்டர் முன்னால் {type}. வேகத்தை {v} கிமீ/ம ஆகக் குறையுங்கள்.', 'drive.now': 'முன்னால் {type}. வேகத்தை {v} கிமீ/ம ஆகக் குறையுங்கள்.', 'drive.gps': 'GPS க்காகக் காத்திருக்கிறது…',
  'drive.sensor': 'குலுக்கல் கண்டறிதல் இயங்குகிறது', 'drive.sensorDenied': 'இயக்க உணரி அனுமதி மறுக்கப்பட்டதால் குலுக்கல் கேள்விகள் நிறுத்தப்பட்டுள்ளன. உலாவி அமைப்புகளில் அனுமதித்து மீண்டும் தொடங்கு அழுத்துங்கள்.', 'drive.noSensor': 'இந்தச் சாதனத்தில் குலுக்கல் கண்டறிதல் இல்லை.',
  'drive.bump': 'இப்போது குலுங்கியதா?', 'drive.bumpSb': 'வேகத்தடை', 'drive.bumpPh': 'குழி', 'drive.bumpNone': 'எதுவுமில்லை',
  'drive.needLogin': 'புகார் அனுப்ப சரிபார்க்கப்பட்ட மின்னஞ்சலுடன் உள்நுழையுங்கள்.', 'drive.sent': 'புகார் அனுப்பப்பட்டது, நன்றி', 'drive.close': 'மூடு',
  'drive.safety': 'கவனத்தைச் சாலையில் வையுங்கள். இந்தத் திரை உதவி மட்டுமே, உத்தரவாதம் அல்ல.', 'drive.hazards': 'பாதையில் ஆபத்துகள்',
  'drive.noRoute': 'முதலில் ஒரு பாதையைச் சோதியுங்கள், பிறகு ஓட்டுநர் பயன்முறையைத் திறக்கவும்.',
  'type.pothole': 'குழி', 'type.speedbreaker': 'வேகத்தடை',
  'sev.High': 'அதிக', 'sev.Medium': 'நடுத்தர', 'sev.Low': 'குறைந்த',
  'authority.btn': 'அதிகாரிகளுக்குப் புகாரளி', 'authority.title': 'சாலை ஆபத்துகளை அதிகாரிகளுக்குப் புகாரளி', 'authority.to': 'பெறுநர்',
  'authority.toDefault': 'மாநகராட்சி ஆணையர் / நெடுஞ்சாலைத் துறை', 'authority.subject': '{from} முதல் {to} வரையிலான பாதையில் சாலை ஆபத்துகள்',
  'authority.intro': 'ஐயா/அம்மையீர்,\n\n{from} முதல் {to} வரையிலான பாதையில் உள்ள சாலை ஆபத்துகளைத் தெரிவிக்கிறேன். ஒவ்வொரு ஆபத்தும் அதன் இடத்துடனும் கண்டறியப்பட்ட விதத்துடனும் கீழே உள்ளது. தயவுசெய்து ஆய்வு செய்து சரிசெய்யுமாறு வேண்டுகிறேன்.',
  'authority.row': '{n}. {type} ({sev} ஆபத்து), இடம் {where} - {src}',
  'authority.srcDetected': 'ஸ்ட்ரீட் வியூ படத்தில் ({date}) தானாகக் கண்டறியப்பட்டது', 'authority.srcCrowd': '{n} ஓட்டுநர்கள் புகாரளித்து உறுதிப்படுத்தினர்',
  'authority.closing': 'நன்றி.\n\nRoadGuard மூலம் அனுப்பப்பட்டது.', 'authority.none': 'இந்தப் பாதையில் புகாரளிக்க ஆபத்துகள் எதுவும் இல்லை.',
  'authority.copy': 'உரையை நகலெடு', 'authority.copied': 'நகலெடுக்கப்பட்டது', 'authority.email': 'மின்னஞ்சலில் திற', 'authority.print': 'அச்சிடு / PDF ஆகச் சேமி',
  'authority.map': 'வரைபடம்',
};

export const DICT = { en: EN, ta: TA, hi: HI };
export const LANGS = [['en', 'English'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी']];
export const SPEECH_LANG = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };

const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v && v[k] != null ? v[k] : `{${k}}`));
export const translate = (lang, key, vars) => fmt((DICT[lang] && DICT[lang][key]) || EN[key] || key, vars);

export function detectLang() {
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  return nav.startsWith('ta') ? 'ta' : nav.startsWith('hi') ? 'hi' : 'en';
}

function initialLang() {
  try {
    const saved = localStorage.getItem('rg_lang');
    if (saved && DICT[saved]) return saved;
  } catch { /* storage blocked */ }
  return detectLang();
}

const Ctx = createContext({ lang: 'en', setLang: () => {}, t: (k, v) => translate('en', k, v) });

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('rg_lang', lang); } catch { /* storage blocked */ }
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang]);
  return React.createElement(Ctx.Provider, { value }, children);
}

export const useT = () => useContext(Ctx);
