# -*- coding: utf-8 -*-
# Authoring helper for the master timeline. Adds 13 events (+ a note on khandaq) to src/data.ts and the fr/en/es/ar content packs,
# and writes src/chrono/{ar,fr,en,es}.json (group titles). Arabic = original; fr/en/es = DRAFT translations; verification = PENDING_REVIEW.
# Idempotent: skips entities that already exist.
import json, re
L = ['ar', 'en', 'fr', 'es']
def T(*x): return dict(zip(L, x))
IH, BK, IK, QR, SD = 'السيرة النبوية — ابن هشام', 'صحيح البخاري', 'البداية والنهاية — ابن كثير', 'القرآن الكريم', 'الطبقات الكبرى — ابن سعد'
N = None
# id: (kind, period, y, name, when, summary, bio, context, disputed|None, src[(title, locator)], rel)
E = {
'arabia_pre': ('event', 'pre', 560, T('الجزيرة العربية قبل مولد النبي ﷺ', 'Arabia before the Prophet’s birth', 'L’Arabie avant la naissance du Prophète ﷺ', 'Arabia antes del nacimiento del Profeta ﷺ'),
  T('قبل 570م', 'Before 570 CE', 'Avant 570', 'Antes del 570'),
  T('المجتمع القبلي في الجزيرة العربية ومكانة قريش ومكة قبل مولد النبي ﷺ.', 'The tribal society of Arabia and the standing of Quraysh and Makkah before the Prophet’s ﷺ birth.', 'La société tribale de l’Arabie et la place des Quraych et de La Mecque avant la naissance du Prophète ﷺ.', 'La sociedad tribal de Arabia y la posición de los Quraysh y La Meca antes del nacimiento del Profeta ﷺ.'),
  T('كانت الحياة في الجزيرة العربية قائمة على القبيلة والتجارة والقوافل، وكانت قريش تتولى شؤون البيت الحرام في مكة، وانتشرت عبادة الأصنام حول الكعبة. وعاش في بعض أطراف الجزيرة وبلداتها يهود ونصارى، ووُجد من العرب من تبرّأ من عبادة الأصنام ويُعرفون بالحنفاء.',
    'Life in Arabia rested on tribe, trade and caravans; Quraysh looked after the Sacred House in Makkah, and idol worship was widespread around the Kaʿba. Jews and Christians lived in some of the peninsula’s towns and borderlands, and some Arabs who rejected idol worship were known as ḥanīfs.',
    'La vie en Arabie reposait sur la tribu, le commerce et les caravanes ; les Quraych veillaient sur la Maison sacrée à La Mecque, et le culte des idoles était répandu autour de la Kaʿba. Des juifs et des chrétiens vivaient dans certaines villes et marges de la péninsule, et certains Arabes qui rejetaient les idoles étaient appelés ḥanīfs.',
    'La vida en Arabia se basaba en la tribu, el comercio y las caravanas; los Quraysh cuidaban la Casa Sagrada en La Meca y el culto a los ídolos estaba extendido alrededor de la Kaaba. Judíos y cristianos vivían en algunas ciudades y fronteras de la península, y algunos árabes que rechazaban los ídolos eran conocidos como ḥanīfs.'),
  T('ذكرت سورة قريش رحلة الشتاء والصيف التي اشتهرت بها قريش.', 'Sūrat Quraysh refers to the winter and summer journeys for which Quraysh were known.', 'La sourate Quraych évoque les voyages d’hiver et d’été pour lesquels les Quraych étaient connus.', 'La sura Quraysh alude a los viajes de invierno y verano por los que eran conocidos los Quraysh.'),
  N, [(IH, 'ذكر عمرو بن لحي وعبادة الأصنام'), (QR, 'سورة قريش')], ['makkah', 'kaaba', 'elephant']),
'childhood': ('event', 'pre', 575, T('طفولته ﷺ ويُتمه', 'Childhood and orphanhood', 'Enfance et orphelinat', 'Infancia y orfandad'),
  T('570 – نحو 578م', '570 – about 578 CE', '570 – environ 578', '570 – hacia el 578'),
  T('نشأة النبي ﷺ يتيمًا بين الرضاعة في بني سعد وكفالة جده ثم عمه.', 'The Prophet ﷺ grew up an orphan, between his nursing among Banū Saʿd and the care of his grandfather and then his uncle.', 'Le Prophète ﷺ grandit orphelin, entre l’allaitement chez les Banū Saʿd et la prise en charge de son grand-père puis de son oncle.', 'El Profeta ﷺ creció huérfano, entre su crianza con los Banū Saʿd y el cuidado de su abuelo y luego de su tío.'),
  T('استُرضع في بني سعد عند حليمة السعدية، ثم عاد إلى أمه آمنة التي توفيت في طريق عودتها من المدينة بالأبواء وهو في نحو السادسة، فكفله جده عبد المطلب، ثم عمه أبو طالب.',
    'He was nursed among Banū Saʿd by Ḥalīma al-Saʿdiyya, then returned to his mother Āmina, who died at al-Abwāʾ on her way back from Madinah when he was about six; his grandfather ʿAbd al-Muṭṭalib then took care of him, followed by his uncle Abū Ṭālib.',
    'Il fut allaité chez les Banū Saʿd par Ḥalīma al-Saʿdiyya, puis revint auprès de sa mère Āmina, qui mourut à al-Abwāʾ au retour de Médine alors qu’il avait environ six ans ; son grand-père ʿAbd al-Muṭṭalib se chargea de lui, puis son oncle Abū Ṭālib.',
    'Fue criado entre los Banū Saʿd por Ḥalīma al-Saʿdiyya y luego volvió con su madre Āmina, que murió en al-Abwāʾ de regreso de Medina cuando él tenía unos seis años; su abuelo ʿAbd al-Muṭṭalib se hizo cargo de él y después su tío Abū Ṭālib.'),
  T('تذكر كتب السير أن عمره عند وفاة جده كان نحو ثماني سنين.', 'The biographies mention that he was about eight years old when his grandfather died.', 'Les biographies indiquent qu’il avait environ huit ans à la mort de son grand-père.', 'Las biografías mencionan que tenía unos ocho años cuando murió su abuelo.'),
  T('تختلف الروايات في عمره عند وفاة أمه وجده، وفي ترتيب بعض الأحداث.', 'Reports differ on his age when his mother and grandfather died, and on the order of some events.', 'Les récits divergent sur son âge à la mort de sa mère et de son grand-père, et sur l’ordre de certains événements.', 'Los relatos discrepan sobre su edad cuando murieron su madre y su abuelo, y sobre el orden de algunos sucesos.'),
  [(IH, 'ذكر رضاعه ﷺ في بني سعد'), (IH, 'ذكر وفاة آمنة وكفالة عبد المطلب وأبي طالب')], ['birth', 'abutalib', 'makkah']),
'youth': ('event', 'pre', 588, T('شبابه ﷺ وأمانته', 'Youth and trustworthiness', 'Jeunesse et loyauté', 'Juventud y honradez'),
  T('نحو 580 – 595م', 'About 580 – 595 CE', 'Environ 580 – 595', 'Hacia 580 – 595'),
  T('رعيه الغنم وسفره بالتجارة وسمعته بالصدق والأمانة قبل البعثة.', 'His shepherding, his trading journeys and his reputation for truthfulness and trustworthiness before the mission.', 'Son travail de berger, ses voyages de commerce et sa réputation de franchise et de loyauté avant la mission.', 'Su pastoreo, sus viajes comerciales y su fama de sinceridad y honradez antes de la misión.'),
  T('عمل ﷺ في رعي الغنم لأهل مكة، وخرج بالتجارة، واشتهر بين قومه بالصادق الأمين، وشهد حلف الفضول مع أعمامه.',
    'He worked as a shepherd for the people of Makkah, travelled for trade, became known among his people as the truthful and trustworthy, and witnessed the Ḥilf al-Fuḍūl pact with his uncles.',
    'Il fut berger pour les gens de La Mecque, voyagea pour le commerce, devint connu parmi les siens comme le véridique et le loyal, et assista avec ses oncles au pacte des Fuḍūl.',
    'Fue pastor para la gente de La Meca, viajó por comercio, se hizo conocido entre su pueblo como el veraz y el honrado, y presenció con sus tíos el pacto de al-Fuḍūl.'),
  T('تذكر بعض كتب السير رحلته إلى الشام مع عمه أبي طالب وهو صغير، ولقاءه بالراهب بحيرى.', 'Some biographies mention a journey to al-Shām with his uncle Abū Ṭālib when he was young, and a meeting with the monk Baḥīrā.', 'Certaines biographies mentionnent un voyage au Shām avec son oncle Abū Ṭālib dans son jeune âge, et une rencontre avec le moine Baḥīrā.', 'Algunas biografías mencionan un viaje a al-Shām con su tío Abū Ṭālib de joven y un encuentro con el monje Baḥīrā.'),
  T('تختلف الروايات في تفاصيل رحلة الشام وفي ثبوت قصة بحيرى، وفي سنّه عند حلف الفضول.', 'Reports differ on the details of the journey to al-Shām, on how firmly the Baḥīrā story is established, and on his age at the Ḥilf al-Fuḍūl.', 'Les récits divergent sur les détails du voyage au Shām, sur l’authenticité de l’histoire de Baḥīrā et sur son âge lors du pacte des Fuḍūl.', 'Los relatos discrepan sobre los detalles del viaje a al-Shām, sobre la solidez del relato de Baḥīrā y sobre su edad en el pacto de al-Fuḍūl.'),
  [(BK, 'كتاب الإجارة، باب رعي الغنم على قراريط'), (IH, 'ذكر حلف الفضول')], ['abutalib', 'khadija', 'marriage', 'makkah']),
'kaaba_rebuild': ('event', 'pre', 605, T('بناء قريش للكعبة وتحكيم النبي ﷺ', 'Quraysh rebuild the Kaʿba; the Prophet ﷺ is chosen as arbiter', 'Les Quraych reconstruisent la Kaʿba ; le Prophète ﷺ est choisi comme arbitre', 'Los Quraysh reconstruyen la Kaaba; el Profeta ﷺ es elegido árbitro'),
  T('نحو 605م (قبل البعثة بنحو خمس سنين)', 'About 605 CE (some five years before the mission)', 'Environ 605 (cinq ans environ avant la mission)', 'Hacia el 605 (unos cinco años antes de la misión)'),
  T('تجديد قريش بناء الكعبة، وتحكيمهم النبي ﷺ في موضع الحجر الأسود.', 'Quraysh renewed the Kaʿba and made the Prophet ﷺ arbiter over the placing of the Black Stone.', 'Les Quraych rénovèrent la Kaʿba et prirent le Prophète ﷺ comme arbitre pour la pose de la Pierre noire.', 'Los Quraysh renovaron la Kaaba y eligieron al Profeta ﷺ como árbitro sobre la colocación de la Piedra Negra.'),
  T('اختلفت قبائل قريش فيمن يضع الحجر الأسود، فاتفقوا على تحكيم أول داخل عليهم، فكان النبي ﷺ، فوضع الحجر في ثوب وحملته القبائل جميعًا ثم وضعه بيده.',
    'The tribes of Quraysh disagreed over who should place the Black Stone and agreed to accept the first person to enter; it was the Prophet ﷺ, who put the stone on a cloth, had all the tribes lift it together, and then set it in place with his own hand.',
    'Les tribus des Quraych se disputèrent sur celui qui poserait la Pierre noire et convinrent de s’en remettre au premier arrivant ; ce fut le Prophète ﷺ, qui plaça la pierre sur un tissu, fit porter celui-ci par toutes les tribus, puis la posa de sa main.',
    'Las tribus de los Quraysh discutieron sobre quién colocaría la Piedra Negra y acordaron aceptar al primero que entrara; fue el Profeta ﷺ, que puso la piedra sobre un paño, hizo que todas las tribus lo levantaran juntas y luego la colocó con su propia mano.'),
  T('كان النبي ﷺ في نحو الخامسة والثلاثين في روايات السير.', 'In the biographical reports the Prophet ﷺ was about thirty-five years old.', 'Dans les récits biographiques, le Prophète ﷺ avait environ trente-cinq ans.', 'En los relatos biográficos el Profeta ﷺ tenía unos treinta y cinco años.'),
  T('تختلف الروايات في سنّه ﷺ عند بناء الكعبة، والمشهور أنه نحو خمس وثلاثين سنة.', 'Reports differ on his age at the rebuilding of the Kaʿba; the best-known figure is about thirty-five.', 'Les récits divergent sur son âge lors de la reconstruction de la Kaʿba ; le chiffre le plus connu est d’environ trente-cinq ans.', 'Los relatos discrepan sobre su edad en la reconstrucción de la Kaaba; la cifra más conocida es de unos treinta y cinco años.'),
  [(IH, 'ذكر بنيان قريش الكعبة')], ['kaaba', 'makkah', 'marriage']),
'secret_dawah': ('event', 'mecca', 610.5, T('الدعوة السرية', 'The private call', 'L’appel discret', 'La llamada privada'),
  T('نحو 610 – 613م', 'About 610 – 613 CE', 'Environ 610 – 613', 'Hacia 610 – 613'),
  T('السنوات الأولى للدعوة سرًّا بين الأقربين والمقرّبين قبل الجهر بها.', 'The first years of the call, made privately among relatives and trusted people before it was made public.', 'Les premières années de l’appel, fait discrètement auprès des proches et des personnes de confiance avant d’être rendu public.', 'Los primeros años de la llamada, hecha en privado entre familiares y personas de confianza antes de hacerse pública.'),
  T('دعا النبي ﷺ سرًّا من يثق بهم، فآمن به خديجة وأبو بكر وعلي وزيد بن حارثة ومن تبعهم، وكان المسلمون يخفون عبادتهم.',
    'The Prophet ﷺ called privately those he trusted; Khadīja, Abū Bakr, ʿAlī, Zayd ibn Ḥāritha and others followed him, and the Muslims kept their worship out of sight.',
    'Le Prophète ﷺ appela discrètement ceux en qui il avait confiance ; Khadīja, Abū Bakr, ʿAlī, Zayd ibn Ḥāritha et d’autres le suivirent, et les musulmans cachaient leur culte.',
    'El Profeta ﷺ llamó en privado a quienes confiaba; Jadīya, Abū Bakr, ʿAlī, Zayd ibn Ḥāritha y otros lo siguieron, y los musulmanes ocultaban su culto.'),
  T('ذكرت السير أن دار الأرقم بن أبي الأرقم كانت من مواضع اجتماع المسلمين.', 'The biographies mention that the house of al-Arqam ibn Abī al-Arqam was one of the places where Muslims met.', 'Les biographies mentionnent que la maison d’al-Arqam ibn Abī al-Arqam fut l’un des lieux de réunion des musulmans.', 'Las biografías mencionan que la casa de al-Arqam ibn Abī al-Arqam fue uno de los lugares de reunión de los musulmanes.'),
  T('المشهور أن المرحلة السرية استمرت نحو ثلاث سنوات، وتختلف الروايات في مدتها.', 'The best-known view is that the private phase lasted about three years; reports differ on its length.', 'On rapporte généralement que la phase discrète dura environ trois ans ; les récits divergent sur sa durée.', 'Se suele decir que la fase privada duró unos tres años; los relatos discrepan sobre su duración.'),
  [(IH, 'ذكر ابتداء الدعوة والسابقين إلى الإسلام')], ['khadija', 'abubakr', 'ali', 'revelation', 'dawah', 'makkah']),
'persecution': ('event', 'mecca', 613.5, T('اضطهاد المسلمين الأوائل', 'Persecution of the early Muslims', 'Persécution des premiers musulmans', 'Persecución de los primeros musulmanes'),
  T('من نحو 613م', 'From about 613 CE', 'À partir d’environ 613', 'Desde hacia el 613'),
  T('الأذى الذي لقيه النبي ﷺ والمستضعفون من المسلمين بعد الجهر بالدعوة.', 'The harm suffered by the Prophet ﷺ and by vulnerable Muslims after the call became public.', 'Les violences subies par le Prophète ﷺ et par les musulmans vulnérables après que l’appel fut rendu public.', 'El daño sufrido por el Profeta ﷺ y por los musulmanes vulnerables después de que la llamada se hizo pública.'),
  T('تعرّض كثير من المسلمين المستضعفين للتعذيب والأذى، ومنهم بلال بن رباح، واشترى أبو بكر عددًا منهم فأعتقهم، وتعرّض النبي ﷺ نفسه للأذى والسخرية.',
    'Many vulnerable Muslims were tortured and harmed, among them Bilāl ibn Rabāḥ; Abū Bakr bought a number of them and freed them, and the Prophet ﷺ himself faced harm and ridicule.',
    'Beaucoup de musulmans vulnérables furent torturés et maltraités, dont Bilāl ibn Rabāḥ ; Abū Bakr en racheta plusieurs et les affranchit, et le Prophète ﷺ lui-même subit des violences et des moqueries.',
    'Muchos musulmanes vulnerables fueron torturados y dañados, entre ellos Bilāl ibn Rabāḥ; Abū Bakr compró a varios y los liberó, y el Profeta ﷺ mismo sufrió daños y burlas.'),
  T('دفعت هذه المحنة بعض المسلمين إلى الهجرة إلى الحبشة.', 'This hardship led some Muslims to emigrate to Abyssinia.', 'Cette épreuve poussa certains musulmans à émigrer en Abyssinie.', 'Esta adversidad llevó a algunos musulmanes a emigrar a Abisinia.'),
  N, [(IH, 'ذكر ما لقي المسلمون من الأذى')], ['bilal', 'abubakr', 'dawah', 'habasha_hijra', 'abutalib']),
'boycott': ('event', 'mecca', 616.5, T('حصار شعب أبي طالب', 'The boycott of the Valley of Abū Ṭālib', 'Le boycott dans le vallon d’Abū Ṭālib', 'El boicot en el valle de Abū Ṭālib'),
  T('نحو 616 – 619م (من السنة السابعة إلى العاشرة للبعثة)', 'About 616 – 619 CE (7th to 10th year of the mission)', 'Environ 616 – 619 (7e à 10e année de la mission)', 'Hacia 616 – 619 (años 7.º a 10.º de la misión)'),
  T('مقاطعة قريش لبني هاشم وبني المطلب وحصارهم في الشعب.', 'The boycott of Banū Hāshim and Banū al-Muṭṭalib by Quraysh, who were confined to the valley.', 'Le boycott des Banū Hāshim et des Banū al-Muṭṭalib par les Quraych, confinés dans le vallon.', 'El boicot de los Banū Hāshim y los Banū al-Muṭṭalib por los Quraysh, que quedaron confinados en el valle.'),
  T('تعاقدت قريش على مقاطعة بني هاشم وبني المطلب في البيع والزواج، فاحتمى النبي ﷺ ومن معه في شعب أبي طالب مدة، ثم نُقضت الصحيفة.',
    'Quraysh agreed to boycott Banū Hāshim and Banū al-Muṭṭalib in trade and marriage; the Prophet ﷺ and those with him took refuge in the valley of Abū Ṭālib for a time, until the pact was annulled.',
    'Les Quraych convinrent de boycotter les Banū Hāshim et les Banū al-Muṭṭalib dans le commerce et le mariage ; le Prophète ﷺ et ceux qui l’accompagnaient se réfugièrent un temps dans le vallon d’Abū Ṭālib, jusqu’à l’annulation du pacte.',
    'Los Quraysh acordaron boicotear a los Banū Hāshim y a los Banū al-Muṭṭalib en el comercio y el matrimonio; el Profeta ﷺ y quienes lo acompañaban se refugiaron un tiempo en el valle de Abū Ṭālib, hasta que se anuló el pacto.'),
  T('جاء بعدها عام الحزن.', 'It was followed by the Year of Sorrow.', 'Elle fut suivie de l’Année de la tristesse.', 'Fue seguido por el Año de la Tristeza.'),
  T('تختلف الروايات في تاريخ بدايتها ومدتها: المشهور نحو ثلاث سنين، وقيل أقل.', 'Reports differ on when it began and how long it lasted: the best-known figure is about three years, and some say less.', 'Les récits divergent sur son début et sa durée : le chiffre le plus connu est d’environ trois ans, certains disent moins.', 'Los relatos discrepan sobre cuándo empezó y cuánto duró: la cifra más conocida es de unos tres años y algunos dicen menos.'),
  [(IH, 'ذكر الصحيفة وحصار الشعب'), (IK, 'حصار بني هاشم في الشعب')], ['abutalib', 'khadija', 'sorrow', 'makkah']),
'taif_trip': ('event', 'mecca', 619.5, T('رحلة الطائف', 'The journey to Ṭāʾif', 'Le voyage à Ṭāʾif', 'El viaje a Ṭāʾif'),
  T('شوال، السنة العاشرة من البعثة – نحو 619م', 'Shawwāl, 10th year of the mission – about 619 CE', 'Shawwāl, 10e année de la mission – environ 619', 'Shawwāl, 10.º año de la misión – hacia el 619'),
  T('خروج النبي ﷺ إلى الطائف يدعو أهلها بعد وفاة أبي طالب وخديجة.', 'The Prophet’s ﷺ journey to Ṭāʾif to call its people, after the deaths of Abū Ṭālib and Khadīja.', 'Le voyage du Prophète ﷺ à Ṭāʾif pour appeler ses habitants, après la mort d’Abū Ṭālib et de Khadīja.', 'El viaje del Profeta ﷺ a Ṭāʾif para llamar a su gente, tras la muerte de Abū Ṭālib y Jadīya.'),
  T('خرج ومعه زيد بن حارثة فعرض الإسلام على سادة ثقيف فردّوه وأغروا به سفهاءهم فرموه بالحجارة، ثم عاد إلى مكة في جوار المطعم بن عدي.',
    'He set out with Zayd ibn Ḥāritha and offered Islam to the leaders of Thaqīf, who rejected him and set their foolish ones against him, so they threw stones at him; he then returned to Makkah under the protection of al-Muṭʿim ibn ʿAdī.',
    'Il partit avec Zayd ibn Ḥāritha et proposa l’islam aux chefs de Thaqīf, qui le rejetèrent et lancèrent contre lui leurs insensés, qui lui jetèrent des pierres ; il retourna ensuite à La Mecque sous la protection d’al-Muṭʿim ibn ʿAdī.',
    'Salió con Zayd ibn Ḥāritha y ofreció el islam a los jefes de Zaqīf, que lo rechazaron y lanzaron contra él a sus insensatos, que le arrojaron piedras; luego volvió a La Meca bajo la protección de al-Muṭʿim ibn ʿAdī.'),
  T('وردت في الصحيح رواية عائشة رضي الله عنها عن أشد ما لقي النبي ﷺ يوم الطائف.', 'The Ṣaḥīḥ contains ʿĀʾisha’s report about the hardest day the Prophet ﷺ faced, at Ṭāʾif.', 'Le Ṣaḥīḥ contient le récit de ʿĀʾisha sur le jour le plus dur que le Prophète ﷺ ait connu, à Ṭāʾif.', 'El Ṣaḥīḥ contiene el relato de ʿĀʾisha sobre el día más duro que vivió el Profeta ﷺ, en Ṭāʾif.'),
  N, [(BK, 'كتاب بدء الخلق'), (IH, 'ذكر خروجه إلى الطائف')], ['taif', 'sorrow', 'abutalib', 'khadija']),
'khaybar': ('event', 'medina', 628.4, T('غزوة خيبر', 'The campaign of Khaybar', 'L’expédition de Khaybar', 'La campaña de Jaybar'),
  T('محرم 7هـ – 628م', 'Muḥarram 7 AH – 628 CE', 'Muḥarram 7 de l’Hégire – 628', 'Muḥarram del año 7 H. – 628'),
  T('حملة المسلمين على حصون يهود خيبر شمال المدينة بعد صلح الحديبية.', 'The Muslims’ campaign against the fortresses of the Jews of Khaybar, north of Madinah, after the Treaty of al-Ḥudaybiya.', 'L’expédition des musulmans contre les forteresses des juifs de Khaybar, au nord de Médine, après le traité d’al-Ḥudaybiya.', 'La campaña de los musulmanes contra las fortalezas de los judíos de Jaybar, al norte de Medina, tras el tratado de al-Ḥudaybiya.'),
  T('سار النبي ﷺ إلى خيبر بعد عودته من الحديبية فحاصر حصونها وفتحها، وأقرّ أهلها على العمل في الأرض بنصف الثمر.',
    'After returning from al-Ḥudaybiya the Prophet ﷺ marched to Khaybar, besieged and took its fortresses, and let its people keep working the land for half of the produce.',
    'Au retour d’al-Ḥudaybiya, le Prophète ﷺ marcha sur Khaybar, assiégea et prit ses forteresses, et laissa ses habitants cultiver la terre pour la moitié de la récolte.',
    'Al volver de al-Ḥudaybiya, el Profeta ﷺ marchó sobre Jaybar, asedió y tomó sus fortalezas, y dejó que su gente siguiera cultivando la tierra por la mitad de la cosecha.'),
  T('ورد في الصحيح أن النبي ﷺ أعطى الراية لعلي بن أبي طالب في هذه الغزوة.', 'The Ṣaḥīḥ reports that the Prophet ﷺ gave the banner to ʿAlī ibn Abī Ṭālib in this campaign.', 'Le Ṣaḥīḥ rapporte que le Prophète ﷺ donna l’étendard à ʿAlī ibn Abī Ṭālib lors de cette expédition.', 'El Ṣaḥīḥ cuenta que el Profeta ﷺ entregó el estandarte a ʿAlī ibn Abī Ṭālib en esta campaña.'),
  T('تختلف الروايات في شهر الغزوة: المشهور محرم من السنة السابعة، وقيل غير ذلك.', 'Reports differ on the month: the best-known view is Muḥarram of the seventh year; other months are also given.', 'Les récits divergent sur le mois : le plus connu est Muḥarram de la septième année ; d’autres mois sont aussi cités.', 'Los relatos discrepan sobre el mes: el más conocido es Muḥarram del séptimo año; también se citan otros meses.'),
  [(BK, 'كتاب المغازي، باب غزوة خيبر'), (IH, 'ذكر غزوة خيبر')], ['hudaybiyyah', 'ali', 'madinah']),
'muta': ('event', 'medina', 629.7, T('غزوة مؤتة', 'The Battle of Muʾta', 'La bataille de Muʾta', 'La batalla de Muʾta'),
  T('جمادى الأولى 8هـ – 629م', 'Jumādā al-Ūlā 8 AH – 629 CE', 'Jumādā al-Ūlā 8 de l’Hégire – 629', 'Jumādā al-Ūlā del año 8 H. – 629'),
  T('معركة بين المسلمين وجيش الروم وحلفائهم في أطراف الشام استُشهد فيها ثلاثة من قادة المسلمين.', 'A battle between the Muslims and the Byzantine army and its allies on the edge of al-Shām, in which three Muslim commanders were martyred.', 'Une bataille entre les musulmans et l’armée byzantine et ses alliés aux confins du Shām, où trois chefs musulmans tombèrent en martyrs.', 'Una batalla entre los musulmanes y el ejército bizantino y sus aliados en el borde de al-Shām, en la que murieron mártires tres comandantes musulmanes.'),
  T('بعث النبي ﷺ جيشًا بقيادة زيد بن حارثة ثم جعفر بن أبي طالب ثم عبد الله بن رواحة، فاستُشهدوا، فأخذ الراية خالد بن الوليد وعاد بالجيش.',
    'The Prophet ﷺ sent an army under Zayd ibn Ḥāritha, then Jaʿfar ibn Abī Ṭālib, then ʿAbd Allāh ibn Rawāḥa; all three were martyred, and Khālid ibn al-Walīd took the banner and brought the army back.',
    'Le Prophète ﷺ envoya une armée sous le commandement de Zayd ibn Ḥāritha, puis de Jaʿfar ibn Abī Ṭālib, puis de ʿAbd Allāh ibn Rawāḥa ; tous trois tombèrent en martyrs, et Khālid ibn al-Walīd prit l’étendard et ramena l’armée.',
    'El Profeta ﷺ envió un ejército bajo Zayd ibn Ḥāritha, luego Jaʿfar ibn Abī Ṭālib y luego ʿAbd Allāh ibn Rawāḥa; los tres murieron mártires, y Jālid ibn al-Walīd tomó el estandarte y devolvió al ejército.'),
  T('ورد في رواية البخاري أن النبي ﷺ سمّى خالدًا سيفًا من سيوف الله عند هذه الواقعة.', 'In al-Bukhārī’s report the Prophet ﷺ called Khālid a sword among the swords of God on this occasion.', 'Dans le récit d’al-Bukhārī, le Prophète ﷺ appela Khālid une épée parmi les épées de Dieu à cette occasion.', 'En el relato de al-Bujārī, el Profeta ﷺ llamó a Jālid una espada de las espadas de Dios en esta ocasión.'),
  T('تتفاوت الروايات في تقدير عدد الجيشين وفي وصف نتيجة اللقاء.', 'Reports vary in the numbers given for the two armies and in how the outcome is described.', 'Les récits varient dans les effectifs donnés pour les deux armées et dans la description de l’issue.', 'Los relatos varían en las cifras de los dos ejércitos y en la descripción del resultado.'),
  [(BK, 'كتاب المغازي، باب غزوة مؤتة من أرض الشام'), (IH, 'ذكر غزوة مؤتة')], ['khalid', 'madinah']),
'hunayn': ('event', 'medina', 630.1, T('غزوة حنين', 'The Battle of Ḥunayn', 'La bataille de Ḥunayn', 'La batalla de Ḥunayn'),
  T('شوال 8هـ – 630م', 'Shawwāl 8 AH – 630 CE', 'Shawwāl 8 de l’Hégire – 630', 'Shawwāl del año 8 H. – 630'),
  T('معركة المسلمين مع هوازن وثقيف بعد فتح مكة.', 'The Muslims’ battle with Hawāzin and Thaqīf after the Conquest of Makkah.', 'La bataille des musulmans contre Hawāzin et Thaqīf après la conquête de La Mecque.', 'La batalla de los musulmanes contra Hawāzin y Zaqīf tras la conquista de La Meca.'),
  T('خرج المسلمون في جيش كبير، فباغتهم العدو في وادي حنين فاضطربت صفوفهم، ثم ثبت النبي ﷺ ومن معه وعاد المسلمون فانتصروا.',
    'The Muslims set out in a large army; the enemy took them by surprise in the valley of Ḥunayn and their ranks wavered, but the Prophet ﷺ and those with him stood firm, the Muslims rallied, and they prevailed.',
    'Les musulmans partirent avec une grande armée ; l’ennemi les surprit dans la vallée de Ḥunayn et leurs rangs vacillèrent, mais le Prophète ﷺ et ceux qui étaient avec lui tinrent bon, les musulmans se ressaisirent et l’emportèrent.',
    'Los musulmanes salieron con un gran ejército; el enemigo los sorprendió en el valle de Ḥunayn y sus filas flaquearon, pero el Profeta ﷺ y quienes estaban con él resistieron, los musulmanes se reagruparon y vencieron.'),
  T('أشار القرآن إلى هذا اليوم في سورة التوبة، ثم توجه المسلمون إلى الطائف.', 'The Qurʾān refers to this day in Sūrat al-Tawba; the Muslims then proceeded to Ṭāʾif.', 'Le Coran évoque ce jour dans la sourate al-Tawba ; les musulmans se dirigèrent ensuite vers Ṭāʾif.', 'El Corán alude a este día en la sura al-Tawba; después los musulmanes se dirigieron a Ṭāʾif.'),
  N, [(BK, 'كتاب المغازي، باب قول الله تعالى: ويوم حنين'), (QR, 'سورة التوبة: 25–26'), (IH, 'ذكر غزوة حنين')], ['fath', 'makkah', 'taif']),
'tabuk': ('event', 'medina', 630.8, T('غزوة تبوك', 'The expedition to Tabūk', 'L’expédition de Tabūk', 'La expedición a Tabūk'),
  T('رجب 9هـ – 630م', 'Rajab 9 AH – 630 CE', 'Rajab 9 de l’Hégire – 630', 'Rajab del año 9 H. – 630'),
  T('خروج النبي ﷺ بجيش كبير نحو تبوك في أطراف الشام ولم يقع قتال.', 'The Prophet’s ﷺ march with a large army towards Tabūk on the edge of al-Shām; no fighting took place.', 'La marche du Prophète ﷺ avec une grande armée vers Tabūk, aux confins du Shām ; aucun combat n’eut lieu.', 'La marcha del Profeta ﷺ con un gran ejército hacia Tabūk, en el borde de al-Shām; no hubo combate.'),
  T('خرج النبي ﷺ في زمن شدة وحرّ لمواجهة ما بلغه من حشود الروم، ووصل تبوك وأقام فيها أيامًا ثم عاد دون قتال، وسُمّي جيشه جيش العسرة.',
    'The Prophet ﷺ set out in a time of hardship and heat to meet what he had heard of Byzantine gatherings; he reached Tabūk, stayed some days, and returned without fighting. His army was called the Army of Hardship.',
    'Le Prophète ﷺ partit en un temps de dureté et de chaleur pour faire face aux rassemblements byzantins dont il avait entendu parler ; il atteignit Tabūk, y resta quelques jours et revint sans combattre. Son armée fut appelée l’armée de la détresse.',
    'El Profeta ﷺ salió en tiempo de dificultad y calor para enfrentar las concentraciones bizantinas de las que había oído; llegó a Tabūk, permaneció unos días y volvió sin combatir. Su ejército se llamó el Ejército de la Penuria.'),
  T('تخلّف عنه ثلاثة من الصحابة ثم تاب الله عليهم.', 'Three Companions stayed behind and were later forgiven.', 'Trois Compagnons restèrent en arrière et furent ensuite pardonnés.', 'Tres Compañeros se quedaron atrás y más tarde fueron perdonados.'),
  T('تتفاوت الروايات في مدة إقامته بتبوك.', 'Reports vary on how long he stayed at Tabūk.', 'Les récits varient sur la durée de son séjour à Tabūk.', 'Los relatos varían sobre cuánto tiempo permaneció en Tabūk.'),
  [(BK, 'كتاب المغازي، باب غزوة تبوك'), (QR, 'سورة التوبة: 117–118')], ['uthman', 'madinah']),
'illness': ('event', 'medina', 631.9, T('مرض النبي ﷺ الأخير', 'The Prophet’s final illness', 'La dernière maladie du Prophète ﷺ', 'La última enfermedad del Profeta ﷺ'),
  T('أواخر صفر – ربيع الأول 11هـ – 632م', 'Late Ṣafar – Rabīʿ al-Awwal 11 AH – 632 CE', 'Fin de Ṣafar – Rabīʿ al-Awwal 11 de l’Hégire – 632', 'Finales de Ṣafar – Rabīʿ al-Awwal del año 11 H. – 632'),
  T('أيام مرض النبي ﷺ الأخيرة في بيت عائشة حتى وفاته.', 'The Prophet’s ﷺ last days of illness in the house of ʿĀʾisha until his death.', 'Les derniers jours de maladie du Prophète ﷺ dans la maison de ʿĀʾisha jusqu’à sa mort.', 'Los últimos días de enfermedad del Profeta ﷺ en la casa de ʿĀʾisha hasta su muerte.'),
  T('اشتد به المرض فاستأذن أزواجه أن يُمرَّض في بيت عائشة فأذنّ له، وأمر أبا بكر أن يصلي بالناس.', 'As his illness grew heavy he asked his wives’ permission to be cared for in ʿĀʾisha’s house, and they agreed; he told Abū Bakr to lead the people in prayer.', 'Sa maladie s’aggrava ; il demanda à ses épouses la permission d’être soigné chez ʿĀʾisha, ce qu’elles acceptèrent, et il demanda à Abū Bakr de diriger la prière.', 'Al agravarse su enfermedad pidió permiso a sus esposas para ser cuidado en la casa de ʿĀʾisha, y ellas aceptaron; ordenó a Abū Bakr dirigir la oración de la gente.'),
  T('سبق مرضَه تجهيزُ جيش أسامة بن زيد.', 'The preparation of the army of Usāma ibn Zayd preceded his illness.', 'La préparation de l’armée d’Usāma ibn Zayd précéda sa maladie.', 'La preparación del ejército de Usāma ibn Zayd precedió a su enfermedad.'),
  T('تختلف الروايات في بداية المرض ومدته: المشهور نحو عشرة أيام، وقيل ثلاثة عشر يومًا.', 'Reports differ on when the illness began and how long it lasted: the best-known figure is about ten days, and some say thirteen.', 'Les récits divergent sur le début et la durée de la maladie : le chiffre le plus connu est d’environ dix jours, certains disent treize.', 'Los relatos discrepan sobre el inicio y la duración de la enfermedad: la cifra más conocida es de unos diez días y algunos dicen trece.'),
  [(BK, 'كتاب المغازي، باب مرض النبي ﷺ ووفاته'), (BK, 'كتاب الأذان، باب أهل العلم والفضل أحق بالإمامة')], ['aisha', 'abubakr', 'death', 'madinah']),
}
KHANDAQ = T('تختلف الروايات في سنة الغزوة: المشهور 5هـ، وقيل 4هـ.', 'Reports differ on the year of the campaign: the best-known view is 5 AH, and some say 4 AH.', 'Les récits divergent sur l’année de l’expédition : le plus connu est 5 de l’Hégire, certains disent 4.', 'Los relatos discrepan sobre el año de la campaña: el más conocido es el 5 H. y algunos dicen el 4.')

REFS = {
 'ذكر عمرو بن لحي وعبادة الأصنام': T(N, 'Account of ʿAmr ibn Luḥayy and idol worship', 'Récit sur ʿAmr ibn Luḥayy et le culte des idoles', 'Relato sobre ʿAmr ibn Luḥayy y el culto a los ídolos'),
 'سورة قريش': T(N, 'Sūrat Quraysh', 'Sourate Quraych', 'Sura Quraysh'),
 'ذكر رضاعه ﷺ في بني سعد': T(N, 'Account of his nursing among Banū Saʿd', 'Récit de son allaitement chez les Banū Saʿd', 'Relato de su crianza entre los Banū Saʿd'),
 'ذكر وفاة آمنة وكفالة عبد المطلب وأبي طالب': T(N, 'Account of Āmina’s death and the care of ʿAbd al-Muṭṭalib and Abū Ṭālib', 'Récit de la mort d’Āmina et de la prise en charge par ʿAbd al-Muṭṭalib et Abū Ṭālib', 'Relato de la muerte de Āmina y del cuidado de ʿAbd al-Muṭṭalib y Abū Ṭālib'),
 'كتاب الإجارة، باب رعي الغنم على قراريط': T(N, 'Book of Hiring, chapter: shepherding for a few qirāṭs', 'Livre du louage, chapitre : garder les moutons pour quelques qirāṭ', 'Libro del alquiler, capítulo: pastorear por unos pocos qirāṭ'),
 'ذكر حلف الفضول': T(N, 'Account of the Ḥilf al-Fuḍūl pact', 'Récit du pacte des Fuḍūl', 'Relato del pacto de al-Fuḍūl'),
 'ذكر بنيان قريش الكعبة': T(N, 'Account of the Quraysh rebuilding of the Kaʿba', 'Récit de la reconstruction de la Kaʿba par les Quraych', 'Relato de la reconstrucción de la Kaaba por los Quraysh'),
 'ذكر ابتداء الدعوة والسابقين إلى الإسلام': T(N, 'Account of the beginning of the call and the first to accept Islam', 'Récit du début de l’appel et des premiers convertis', 'Relato del inicio de la llamada y de los primeros en abrazar el islam'),
 'ذكر ما لقي المسلمون من الأذى': T(N, 'Account of the harm the Muslims suffered', 'Récit des violences subies par les musulmans', 'Relato del daño que sufrieron los musulmanes'),
 'ذكر الصحيفة وحصار الشعب': T(N, 'Account of the pact document and the siege of the valley', 'Récit du document du pacte et du siège du vallon', 'Relato del documento del pacto y del asedio del valle'),
 'حصار بني هاشم في الشعب': T(N, 'The siege of Banū Hāshim in the valley', 'Le siège des Banū Hāshim dans le vallon', 'El asedio de los Banū Hāshim en el valle'),
 'كتاب بدء الخلق': T(N, 'Book of the Beginning of Creation', 'Livre du commencement de la création', 'Libro del comienzo de la creación'),
 'ذكر خروجه إلى الطائف': T(N, 'Account of his journey to Ṭāʾif', 'Récit de son voyage à Ṭāʾif', 'Relato de su viaje a Ṭāʾif'),
 'كتاب المغازي، باب غزوة خيبر': T(N, 'Book of the Campaigns, chapter: the campaign of Khaybar', 'Livre des expéditions, chapitre : l’expédition de Khaybar', 'Libro de las campañas, capítulo: la campaña de Jaybar'),
 'ذكر غزوة خيبر': T(N, 'Account of the campaign of Khaybar', 'Récit de l’expédition de Khaybar', 'Relato de la campaña de Jaybar'),
 'كتاب المغازي، باب غزوة مؤتة من أرض الشام': T(N, 'Book of the Campaigns, chapter: the campaign of Muʾta in the land of al-Shām', 'Livre des expéditions, chapitre : l’expédition de Muʾta en terre du Shām', 'Libro de las campañas, capítulo: la campaña de Muʾta en tierras de al-Shām'),
 'ذكر غزوة مؤتة': T(N, 'Account of the campaign of Muʾta', 'Récit de l’expédition de Muʾta', 'Relato de la campaña de Muʾta'),
 'كتاب المغازي، باب قول الله تعالى: ويوم حنين': T(N, 'Book of the Campaigns, chapter: the saying of God, “and on the day of Ḥunayn”', 'Livre des expéditions, chapitre : la parole de Dieu « et le jour de Ḥunayn »', 'Libro de las campañas, capítulo: la palabra de Dios «y el día de Ḥunayn»'),
 'سورة التوبة: 25–26': T(N, 'Sūrat al-Tawba 9:25–26', 'Sourate al-Tawba 9:25–26', 'Sura al-Tawba 9:25–26'),
 'ذكر غزوة حنين': T(N, 'Account of the campaign of Ḥunayn', 'Récit de l’expédition de Ḥunayn', 'Relato de la campaña de Ḥunayn'),
 'كتاب المغازي، باب غزوة تبوك': T(N, 'Book of the Campaigns, chapter: the campaign of Tabūk', 'Livre des expéditions, chapitre : l’expédition de Tabūk', 'Libro de las campañas, capítulo: la campaña de Tabūk'),
 'سورة التوبة: 117–118': T(N, 'Sūrat al-Tawba 9:117–118', 'Sourate al-Tawba 9:117–118', 'Sura al-Tawba 9:117–118'),
 'كتاب المغازي، باب مرض النبي ﷺ ووفاته': T(N, 'Book of the Campaigns, chapter: the illness and death of the Prophet ﷺ', 'Livre des expéditions, chapitre : la maladie et la mort du Prophète ﷺ', 'Libro de las campañas, capítulo: la enfermedad y muerte del Profeta ﷺ'),
 'كتاب الأذان، باب أهل العلم والفضل أحق بالإمامة': T(N, 'Book of the Call to Prayer, chapter: people of knowledge and merit have most right to lead the prayer', 'Livre de l’appel à la prière, chapitre : les gens de science et de mérite ont le plus de droit à diriger la prière', 'Libro de la llamada a la oración, capítulo: la gente de ciencia y mérito tiene más derecho a dirigir la oración'),
}

GROUPS = [  # id, title, range, intro (T)
 ('g1', T('الجزيرة العربية قبل مولد النبي ﷺ', 'Arabia before the Prophet’s birth', 'L’Arabie avant la naissance du Prophète', 'Arabia antes del nacimiento del Profeta'), T('قبل 570م', 'Before 570 CE', 'Avant 570', 'Antes del 570'), T('المجتمع القبلي ومكانة قريش ومكة وعام الفيل.', 'Tribal society, Quraysh and Makkah, and the Year of the Elephant.', 'La société tribale, les Quraych, La Mecque et l’Année de l’Éléphant.', 'La sociedad tribal, los Quraysh, La Meca y el Año del Elefante.')),
 ('g2', T('مولده وطفولته ﷺ', 'Birth and childhood', 'Naissance et enfance', 'Nacimiento e infancia'), T('570 – نحو 578م', '570 – about 578 CE', '570 – environ 578', '570 – hacia 578'), T('المولد واليُتم والكفالة.', 'The birth, orphanhood and guardianship.', 'La naissance, l’orphelinat et la tutelle.', 'El nacimiento, la orfandad y la tutela.')),
 ('g3', T('الشباب والنشأة', 'Youth and early life', 'Jeunesse et débuts de la vie', 'Juventud y primeros años'), T('نحو 580 – 595م', 'About 580 – 595 CE', 'Environ 580 – 595', 'Hacia 580 – 595'), T('الرعي والتجارة والسمعة بالصدق والأمانة.', 'Shepherding, trade, and a reputation for truthfulness.', 'Le pastoralisme, le commerce et la réputation de loyauté.', 'El pastoreo, el comercio y la fama de honradez.')),
 ('g4', T('الزواج من خديجة', 'Marriage to Khadīja', 'Le mariage avec Khadīja', 'El matrimonio con Jadīya'), T('نحو 595 – 605م', 'About 595 – 605 CE', 'Environ 595 – 605', 'Hacia 595 – 605'), T('الزواج، ثم بناء الكعبة قبل البعثة.', 'The marriage, followed by the rebuilding of the Kaʿba before the mission.', 'Le mariage, puis la reconstruction de la Kaʿba avant la mission.', 'El matrimonio y después la reconstrucción de la Kaaba antes de la misión.')),
 ('g5', T('الوحي الأول', 'The first revelation', 'La première révélation', 'La primera revelación'), T('رمضان – نحو 610م', 'Ramaḍān – about 610 CE', 'Ramaḍān – environ 610', 'Ramaḍān – hacia 610'), T('نزول الوحي في غار حراء.', 'The revelation in the cave of Ḥirāʾ.', 'La révélation dans la grotte de Ḥirāʾ.', 'La revelación en la cueva de Ḥirāʾ.')),
 ('g6', T('السنوات الأولى للإسلام في مكة', 'The early years of Islam in Makkah', 'Les premières années de l’islam à La Mecque', 'Los primeros años del islam en La Meca'), T('نحو 610 – 613م', 'About 610 – 613 CE', 'Environ 610 – 613', 'Hacia 610 – 613'), T('الدعوة السرية وأوائل المسلمين.', 'The private call and the first Muslims.', 'L’appel discret et les premiers musulmans.', 'La llamada privada y los primeros musulmanes.')),
 ('g7', T('الجهر بالدعوة والاضطهاد', 'Public preaching and persecution', 'La prédication publique et la persécution', 'La predicación pública y la persecución'), T('من نحو 613م', 'From about 613 CE', 'À partir d’environ 613', 'Desde hacia 613'), T('إعلان الدعوة وأذى المشركين للمسلمين.', 'The public call and the harm done to the Muslims.', 'L’appel public et les violences contre les musulmans.', 'La llamada pública y el daño causado a los musulmanes.')),
 ('g8', T('الهجرة إلى الحبشة', 'Migration to Abyssinia', 'L’émigration en Abyssinie', 'La emigración a Abisinia'), T('نحو 615م', 'About 615 CE', 'Environ 615', 'Hacia 615'), T('لجوء المسلمين إلى النجاشي.', 'The Muslims’ refuge with the Negus.', 'Le refuge des musulmans auprès du Négus.', 'El refugio de los musulmanes con el Negus.')),
 ('g9', T('الحصار وعام الحزن', 'The boycott and the Year of Sorrow', 'Le boycott et l’Année de la tristesse', 'El boicot y el Año de la Tristeza'), T('نحو 616 – 619م', 'About 616 – 619 CE', 'Environ 616 – 619', 'Hacia 616 – 619'), T('الحصار في الشعب، ووفاة أبي طالب وخديجة، ورحلة الطائف.', 'The boycott, the deaths of Abū Ṭālib and Khadīja, and the journey to Ṭāʾif.', 'Le boycott, la mort d’Abū Ṭālib et de Khadīja, et le voyage à Ṭāʾif.', 'El boicot, la muerte de Abū Ṭālib y Jadīya, y el viaje a Ṭāʾif.')),
 ('g10', T('الإسراء والمعراج', 'The Night Journey and Ascension', 'Le Voyage nocturne et l’Ascension', 'El Viaje Nocturno y la Ascensión'), T('قبل الهجرة', 'Before the Hijra', 'Avant l’Hégire', 'Antes de la Hégira'), T('رحلة الإسراء والمعراج.', 'The journey of al-Isrāʾ and al-Miʿrāj.', 'Le voyage d’al-Isrāʾ et d’al-Miʿrāj.', 'El viaje de al-Isrāʾ y al-Miʿrāŷ.')),
 ('g11', T('الهجرة إلى المدينة', 'The Hijra to Madinah', 'L’Hégire vers Médine', 'La Hégira a Medina'), T('621 – 622م', '621 – 622 CE', '621 – 622', '621 – 622'), T('بيعتا العقبة ثم الهجرة.', 'The two pledges of ʿAqaba, then the emigration.', 'Les deux serments d’al-ʿAqaba, puis l’émigration.', 'Los dos juramentos de al-ʿAqaba y luego la emigración.')),
 ('g12', T('قيام المجتمع المسلم', 'Establishment of the Muslim community', 'La fondation de la communauté musulmane', 'La fundación de la comunidad musulmana'), T('1هـ – 622 / 623م', '1 AH – 622 / 623 CE', '1 de l’Hégire – 622 / 623', 'Año 1 H. – 622 / 623'), T('المسجد والمؤاخاة وتنظيم المجتمع.', 'The mosque, the brotherhood and the organisation of the community.', 'La mosquée, la fraternité et l’organisation de la communauté.', 'La mezquita, la hermandad y la organización de la comunidad.')),
 ('g13', T('أحداث المدينة الكبرى والغزوات', 'Major Medinan events and battles', 'Grands événements et batailles de Médine', 'Grandes sucesos y batallas de Medina'), T('2 – 5هـ / 624 – 627م', '2 – 5 AH / 624 – 627 CE', '2 – 5 de l’Hégire / 624 – 627', 'Años 2 – 5 H. / 624 – 627'), T('بدر وأحد والخندق.', 'Badr, Uḥud and the Trench.', 'Badr, Uḥud et le Fossé.', 'Badr, Uḥud y el Foso.')),
 ('g14', T('صلح الحديبية وما تلاه', 'The Treaty of al-Ḥudaybiya and its aftermath', 'Le traité d’al-Ḥudaybiya et ses suites', 'El tratado de al-Ḥudaybiya y sus consecuencias'), T('6 – 7هـ / 628م', '6 – 7 AH / 628 CE', '6 – 7 de l’Hégire / 628', 'Años 6 – 7 H. / 628'), T('الصلح ثم غزوة خيبر.', 'The treaty, then the campaign of Khaybar.', 'Le traité, puis l’expédition de Khaybar.', 'El tratado y luego la campaña de Jaybar.')),
 ('g15', T('فتح مكة', 'The Conquest of Makkah', 'La conquête de La Mecque', 'La conquista de La Meca'), T('8هـ / 629 – 630م', '8 AH / 629 – 630 CE', '8 de l’Hégire / 629 – 630', 'Año 8 H. / 629 – 630'), T('مؤتة ثم فتح مكة ثم حنين.', 'Muʾta, then the Conquest of Makkah, then Ḥunayn.', 'Muʾta, puis la conquête de La Mecque, puis Ḥunayn.', 'Muʾta, luego la conquista de La Meca y después Ḥunayn.')),
 ('g16', T('تبوك وحجة الوداع', 'Tabūk and the Farewell Pilgrimage', 'Tabūk et le Pèlerinage d’adieu', 'Tabūk y la Peregrinación de Despedida'), T('9 – 10هـ / 630 – 632م', '9 – 10 AH / 630 – 632 CE', '9 – 10 de l’Hégire / 630 – 632', 'Años 9 – 10 H. / 630 – 632'), T('غزوة تبوك ثم حجة الوداع.', 'The expedition to Tabūk, then the Farewell Pilgrimage.', 'L’expédition de Tabūk, puis le Pèlerinage d’adieu.', 'La expedición a Tabūk y luego la Peregrinación de Despedida.')),
 ('g17', T('المرض الأخير ووفاة النبي ﷺ', 'The final illness and death of the Prophet ﷺ', 'La dernière maladie et la mort du Prophète ﷺ', 'La última enfermedad y la muerte del Profeta ﷺ'), T('ربيع الأول 11هـ – 632م', 'Rabīʿ al-Awwal 11 AH – 632 CE', 'Rabīʿ al-Awwal 11 de l’Hégire – 632', 'Rabīʿ al-Awwal del año 11 H. – 632'), T('مرض النبي ﷺ ووفاته.', 'The Prophet’s ﷺ illness and death.', 'La maladie et la mort du Prophète ﷺ.', 'La enfermedad y muerte del Profeta ﷺ.')),
]

def q(s): return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"
# ---- 1. data.ts (Arabic) ----
p = 'src/data.ts'; s = open(p, encoding='utf-8').read(); add = []
for i, (kind, per, y, name, when, summ, bio, ctx, dis, src, rel) in E.items():
    if f"id: '{i}'" in s: continue
    srcs = ', '.join(f"[{q(t)}, {q(l)}]" if False else f"[{ {IH:'IH',BK:'BK',IK:'IK',QR:'QR',SD:'SD'}[t] }, {q(l)}]" for t, l in src)
    add.append(f"  E({{ id: '{i}', kind: '{kind}', name: {q(name['ar'])}, period: '{per}', when: {q(when['ar'])}, y: {y},\n    summary: {q(summ['ar'])},\n    bio: {q(bio['ar'])},\n    context: {q(ctx['ar'])},\n" + (f"    disputed: {q(dis['ar'])},\n" if dis else '') + f"    src: [{srcs}], rel: [{', '.join(q(r) for r in rel)}] }}),")
if add:
    s = s.replace("\n]\n// ", "\n  // ---------- خط الزمن الرئيسي (أحداث مضافة) ----------\n" + "\n".join(add) + "\n]\n// ", 1) if "\n]\n// " in s else s.rstrip().rstrip(']').rstrip() + "\n\n  // ---------- خط الزمن الرئيسي (أحداث مضافة) ----------\n" + "\n".join(add) + "\n]\n"
# khandaq note (adds a `disputed` field)
if "id: 'khandaq'" in s and "id: 'khandaq'" in s and 'سنة الغزوة' not in s:
    s = s.replace("context: 'نزلت فيها آيات سورة الأحزاب.', src:", f"context: 'نزلت فيها آيات سورة الأحزاب.', disputed: {q(KHANDAQ['ar'])}, src:", 1)
open(p, 'w', encoding='utf-8').write(s)

# ---- 2. content packs ----
for l in L:
    p = f'src/locales/content/{l}.json'; c = json.load(open(p, encoding='utf-8'))
    for i, (kind, per, y, name, when, summ, bio, ctx, dis, src, rel) in E.items():
        if i in c['entities']: continue
        if l == 'ar': c['entities'][i] = {'verification': {'status': 'PENDING_REVIEW'}}
        else:
            e = {'name': name[l], 'when': when[l], 'summary': summ[l], 'bio': bio[l], 'context': ctx[l]}
            if dis: e['disputed'] = dis[l]
            e['translation'] = {'status': 'draft'}; e['verification'] = {'status': 'PENDING_REVIEW'}
            c['entities'][i] = e
    if l != 'ar':
        if 'disputed' not in c['entities']['khandaq']:
            kk = c['entities']['khandaq']; new = {}
            for k, v in kk.items():
                if k == 'bio': new['disputed'] = KHANDAQ[l]
                new[k] = v
            c['entities']['khandaq'] = new
        for k, v in REFS.items(): c['refs'].setdefault(k, v[l])
    json.dump(c, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2); open(p, 'a').write('\n')

# ---- 3. timeline packs ----
import os; os.makedirs('src/chrono', exist_ok=True)
for l in L:
    d = {'verification': {'status': 'PENDING_REVIEW'}, 'groups': {g: {'title': t[l], 'range': r[l], 'intro': n[l]} for g, t, r, n in GROUPS}}
    if l != 'ar': d = {'translation': {'status': 'draft'}, **d}
    json.dump(d, open(f'src/chrono/{l}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2); open(f'src/chrono/{l}.json', 'a').write('\n')
print('ok', len(E), 'events')
