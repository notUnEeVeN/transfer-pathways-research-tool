/**
 * Standalone, fail-closed audit for the George Mason recursive prerequisite
 * closure.  This module deliberately is not wired into acquisition/review:
 * it proves which exact cached rows can be resolved without changing shared
 * generated artifacts while also pinning every still-missing reference.
 *
 * `none` below means only "this complete entry publishes no required
 * prerequisite or corequisite". Recommendations, repeat/credit restrictions,
 * grade notes, equivalencies, attempt limits, and enrollment restrictions are
 * retained as span-bound nonrequired evidence.
 */

const crypto = require('node:crypto');
const {
  catalogYearSeen,
  extractCourseLeafEntries,
} = require('./universityPrerequisiteAcquisition');
const {
  browserDocumentLooksLikeInterstitial,
} = require('./browserChallengeCourseLeafAcquisition');

const CONTRACT =
  'gmu_recursive_closure_exact_courseleaf_silence_and_missing_reference_audit_v1';
const SCHOOL_ID = 9210;
const SLUG = 'george-mason-university';
const OWNER = 'va:uni:9210';
const CATALOG_YEAR = '2026-2027';
const BOUNDARY = 'unique_courseblock_exact_leading_code_with_published_units';
const RECEIPT =
  'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1';
const REVIEW_REASON =
  'exact_gmu_recursive_complete_entry_no_required_requisite_with_nonrequired_signals_preserved';
const CACHE_REACQUISITION_RECEIPT =
  'gmu_exact_cached_courseleaf_response_revalidated_after_false_interstitial_block_v1';

// Compact page receipts: url, cache path, response hash/bytes, total
// courseblocks, complete blocks, and same-page required-label controls.
const PAGES = Object.freeze({
  arab: ['https://catalog.gmu.edu/courses/arab/', 'university-prerequisites/raw/george-mason-university/george-mason-university__arab.html', '0ccfb984d2b0b19928a75e11a02ffd5ebdab90788f8c41a82f3eda51f1e49459', 59116, 27, 27, 22],
  bus: ['https://catalog.gmu.edu/courses/bus/', 'university-prerequisites/raw/george-mason-university/george-mason-university__bus.html', 'a0df6d377b29220062693deb5d803c8cc571497316903083b8f85954841da3d2', 63273, 24, 24, 8],
  cds: ['https://catalog.gmu.edu/courses/cds/', 'university-prerequisites/raw/george-mason-university/george-mason-university__cds.html', '19700bd251c814bb990f1b441122e2a32191f1885044a154ba834e8bf8dd5e3f', 59765, 28, 28, 22],
  chin: ['https://catalog.gmu.edu/courses/chin/', 'university-prerequisites/raw/george-mason-university/george-mason-university__chin.html', 'c0e7a438a83f0b3bd860d992853e9b172ad34e84ed0542a6da7efb5b9b9e647b', 70935, 36, 36, 17],
  clas: ['https://catalog.gmu.edu/courses/clas/', 'university-prerequisites/raw/george-mason-university/george-mason-university__clas.html', '8b686efe51cff3cd7f5447c25e8c261a53e7f4ea084eda6fe3680802dc36b619', 32332, 9, 9, 8],
  cs: ['https://catalog.gmu.edu/courses/cs/', 'university-prerequisites/raw/george-mason-university/george-mason-university__cs.html', '5180e1335639e2e9d1778c0dd19d051ed3cce9e4035b6749597ab56cef4e5600', 222649, 103, 103, 95],
  eled: ['https://catalog.gmu.edu/courses/eled/', 'university-prerequisites/raw/george-mason-university/george-mason-university__eled.html', '2651731b5498bef2df363f1b14c529bf4c5f0eae41c11dab169f0d3d37a3323e', 64479, 35, 35, 23],
  engh: ['https://catalog.gmu.edu/courses/engh/', 'university-prerequisites/raw/george-mason-university/george-mason-university__engh.html', '35036ea113eaf362d2e9d6eccd9db508c40e36452dcab0a2a1d1237884bd7b42', 288842, 202, 202, 134],
  fren: ['https://catalog.gmu.edu/courses/fren/', 'university-prerequisites/raw/george-mason-university/george-mason-university__fren.html', '8941dbffaed94966338010192d9b7f551b49a80d5a9be7c9b3aca45dc71ba705', 94195, 54, 54, 31],
  frln: ['https://catalog.gmu.edu/courses/frln/', 'university-prerequisites/raw/george-mason-university/george-mason-university__frln.html', '27b876f506f0bcbd5fde69106c3085b767811ae732f5ef72e9e491af9a47d513', 55194, 25, 25, 10],
  germ: ['https://catalog.gmu.edu/courses/germ/', 'university-prerequisites/raw/george-mason-university/george-mason-university__germ.html', '6327b315e8c19316e2b8efa3b69651d973fb90223978ea7653cbcbd4ce02a450', 48898, 21, 21, 17],
  hist: ['https://catalog.gmu.edu/courses/hist/', 'university-prerequisites/raw/george-mason-university/george-mason-university__hist.html', 'bebe812df2c3a62d60fc32ae44b109a20ec8c04c41450c43e0685d6247756195', 216368, 168, 168, 24],
  hnrs: ['https://catalog.gmu.edu/courses/hnrs/', 'university-prerequisites/raw/george-mason-university/george-mason-university__hnrs.html', '06275c40a82bb91e84898d7fde77ea997290a83d50983d5f2c4fd37b62abb1f7', 36519, 10, 10, 6],
  ints: ['https://catalog.gmu.edu/courses/ints/', 'university-prerequisites/raw/george-mason-university/george-mason-university__ints.html', '65ae90f5018a15f3640f83b446946b91d6db31210305619fd209cf4ec274d23a', 144092, 107, 107, 10],
  ital: ['https://catalog.gmu.edu/courses/ital/', 'university-prerequisites/raw/george-mason-university/george-mason-university__ital.html', 'ed25e4598db37a2ecd87de2fba3c03b77da4a4464322e6b0dd8d702e6b8cae79', 39648, 12, 12, 10],
  japa: ['https://catalog.gmu.edu/courses/japa/', 'university-prerequisites/raw/george-mason-university/george-mason-university__japa.html', '79fef88dd7a20edd96d2a975448186531fbfa97b93a3def50fa1259eaebe3e9d', 48356, 19, 19, 13],
  kore: ['https://catalog.gmu.edu/courses/kore/', 'university-prerequisites/raw/george-mason-university/george-mason-university__kore.html', 'ee3e83a21718d0110a269fd7e26f04b726906c220b3f52e701b318c3e5bc46af', 78251, 40, 40, 31],
  reli: ['https://catalog.gmu.edu/courses/reli/', 'university-prerequisites/raw/george-mason-university/george-mason-university__reli.html', '51826bec3c85348f61bb07a2ee7f7336e870369a6f0024ab6252c20cc182be0c', 102972, 72, 72, 16],
  russ: ['https://catalog.gmu.edu/courses/russ/', 'university-prerequisites/raw/george-mason-university/george-mason-university__russ.html', '3c22c1fde23a6d0c1a583cc36b8eb725b5f2828dd5a94ded325f4fd49a1f5cb9', 50630, 23, 23, 17],
  span: ['https://catalog.gmu.edu/courses/span/', 'university-prerequisites/raw/george-mason-university/george-mason-university__span.html', '8890e9575711028c208832b300c4b75a4aaeec1b06ae419a21c46d71214b58b3', 142910, 85, 85, 55],
  stat: ['https://catalog.gmu.edu/courses/stat/', 'university-prerequisites/raw/george-mason-university/george-mason-university__stat.html', 'a6524e5a4df53ee6189dc2affc3e22c48d07d5760b0e4122897370fcf01dabfa', 170317, 71, 71, 67],
  syst: ['https://catalog.gmu.edu/courses/syst/', 'university-prerequisites/raw/george-mason-university/george-mason-university__syst.html', 'b9d848195b2aa4de8a4075af1134570e5e2c56182b7d958e2e907c6b04802bf7', 259634, 104, 104, 81],
});

// Compact row receipts: page, courseblock index, normalized entry length,
// normalized entry hash, raw entry HTML hash, unit tuple, generic marker tuple,
// retained signal count, retained [kind, raw] digest.
const ROWS = Object.freeze({
  ARAB325: ['arab', 7, 573, '778d60488637c546a985a05973fec5ab5dc114944471b2ec6c1721da5c615a80', '5e79a09fe3a4825f4b4a0dec1e5f7599ace40b24f58715711c6b9b61b14ffdba', ['3 credits', 3, 3, '09846fa9ae107e5f133775f1ad2662344d2322db20e9c21dcad398a45e790ce7'], [1, 0, 1, 3], 4, 'af3d45ef2a97073d3d88c58756bee18bce60e77d90f2f61878523dd723a3f5f9'],
  ARAB365: ['arab', 13, 1077, '34226b81ee8f3a4afd325a3b3ca931f211bdb49e18213abf7ac3bef97772b104', '157b3fde2b63a46bca79d7505452e9aa97eff74713186ddf8478dc7ea13eb52e', ['3 credits', 3, 3, 'c9c4f889ee5d4d1fbf7dd67fa69dadd720995be8ddaf27b471bf4de71c73a3fe'], [0, 0, 0, 2], 2, '41528e4695355c050bf67a3e39562f41379d2a5cf9797b213c30019c74fc5b96'],
  BUS210: ['bus', 3, 868, '633b47ceda8398df38d6a935d0a41600bc80f20296a4243bdff4cad6a14f680f', 'f584aeb32712386a5173b8bce3cb88324da27dcd5bae13ed4b882e7be5cba524', ['3 credits', 3, 3, '0ebba3fd6351377fbb4ad4c8a76ecfe6aa01cfe04dcc3fd2d2beaa54502032aa'], [0, 0, 0, 3], 3, 'a969706651611e4f056bf4fd5fa636c872db69e71e9cde53ed912843ae7052ac'],
  CDS130: ['cds', 2, 759, 'be420b586c737b15e78edd55f6508d45a2586ebbf54424fafc6b6d014723e447', '4f12f490c3be055a2ab1653f3a0871835b2ff2bfbea8cb94fd10e4fb0d54ee9d', ['3 credits', 3, 3, '4656f0ad1c22609bfe0180351738d99b08483ba38de696ca482e017c78dc87b8'], [1, 0, 1, 1], 2, 'da600f05136772cc80353e89380e49f4f7a487282d0b17a2afaaaa8f81f707c0'],
  CHIN310: ['chin', 8, 736, '271ee3b68306cbdaf8115e9833d9d5254d31453a200b6c36904e1183ab47b430', '18f45026b0a2a99a25b518f5d4613c7d0ead67770181cac325b9e78d08be6013', ['3 credits', 3, 3, '66f7631554b311cdb4ed9e136e229689c1c96fc4c6d5bda17ffd5dd425331cc7'], [1, 0, 1, 2], 4, '32ca88ba2aa450c009ed9748a0cec815ebff6280684573049e7a9fea3466a2f9'],
  CHIN311: ['chin', 9, 591, '91e7506e0e5503414d70f66a4de137687e683da881fa91934034b103ee112659', 'f6418807ad268716375eb5e1063598ff95f7205e00b5ffa72ced459364984e39', ['3 credits', 3, 3, '7bc463bb02c320b3ed8ba71c7cfdd1ee159f648eaae98cb5841ccade36fbd7d5'], [1, 0, 1, 2], 3, '71dfc73c2d95eff5609e241f007b828aa479d92679bc2e0837c8c12a0ab1d4da'],
  CHIN325: ['chin', 12, 574, 'e57541e4ea76659005d2b97a37802334408e7f9133254dc5b5cf85055ac8f548', '21c412a5f503b8cf9f2061c86cd2e4e7e80e01eb784577b6eca7a110f12bc725', ['3 credits', 3, 3, '9438b682e6aafd3995ace95104babe39f3b326a6771dcf1263db6b0ecad1528b'], [1, 0, 1, 2], 4, 'a49ffd4344761646aae5d3c3383bdc1eee69dac620c5a829e77d8a18e1f71b8b'],
  CHIN328: ['chin', 13, 777, 'c3615b51094eb04fe0634ea7aed6be5cf7bd8170dc1542899162c30bce9f7352', 'f78cd850792e38600e24517a4426d12231dc59a7f8cb01ccf752fcf9f523a1c7', ['3 credits', 3, 3, 'a07190de7f571acb5ba05b7c56dcb074da39a254eec7692800e4c8833df0971a'], [0, 0, 0, 1], 2, 'a6e20ef5e33b571332c41e2a73cb4ccf47158b146dbe07caeefeb01d3ebe402e'],
  CLAS250: ['clas', 1, 417, '612f8dd6d05dd6e6960051fcf24ee50185b73dc89bc8246ce7a18be510a7dd04', '2922012edaf3d1709bf20d8ae434ad17c728e57542aecab23ee32d0549eee144', ['3 credits', 3, 3, '03ebbaad28e087e91a56098033cd6dd82bc5183aa9a5bc08c5cd9b76d1b7a4f3'], [1, 0, 1, 1], 3, '5f2b9a2fdee1dbdcda6455d0cf541e9bee7c47ba3360c1735d0df42f52252c34'],
  CLAS260: ['clas', 2, 621, 'a80b44a19a4aa6de1b16d8b8f34346a2532860f866fa9f4e35f26a6f0e82dea6', 'baa07e12440a80be7c5ef3dff4b6ee3d5b7401f290d24c448a2fe75eb807479a', ['3 credits', 3, 3, 'b6759e47c25bf1b8f948ea5c536883dbee0a8961dd4f4ec18e260d2161b40b8d'], [1, 0, 1, 1], 3, 'cc064492cc506f7dcdbc92b0a48916fb45bc0281dd2c7dbed78f404449b48f96'],
  CLAS340: ['clas', 4, 481, 'dfc62689d978682c9c7f17decf0590c5c2c71e96b38050306ceb3558b4fdcde4', '5631f4e6fa8afae5642cf797e5804a0d5fd44501e3183e47f05bcf8f4d315711', ['3 credits', 3, 3, '52d68319b232c48a88be553cb291f57c3593899f111fa097cee278c32c63731a'], [1, 0, 1, 1], 3, 'cc064492cc506f7dcdbc92b0a48916fb45bc0281dd2c7dbed78f404449b48f96'],
  CLAS350: ['clas', 5, 567, '6ffc90b0f8175284546238fdbdb08fb3a32791c93d649a977d1e65ab0e7c13ca', 'fe5f1874d4578f8ce33d8e19faa946caf244a0001fb0d0d34499aed3230f8c96', ['3 credits', 3, 3, '678ac0159736c178114e5b1ff8b787a9d2e95bdf54b414dfaddaa6c63e60ed80'], [1, 0, 1, 1], 3, 'cc064492cc506f7dcdbc92b0a48916fb45bc0281dd2c7dbed78f404449b48f96'],
  CLAS360: ['clas', 6, 572, '269d7f8c373b805729bd5edfc678f57aea36d834e9669cb9fe2e3a563eb96cd4', 'd40409c4002e95e7337352f89cd99ba35cee4cd1ecf0f7d874dceb6f5d27248f', ['3 credits', 3, 3, '138f140c5a0c7edbcbe514e47d9167c94eddf713457217c2563e343c4be8d0e7'], [1, 0, 1, 1], 3, 'cc064492cc506f7dcdbc92b0a48916fb45bc0281dd2c7dbed78f404449b48f96'],
  CLAS380: ['clas', 7, 465, 'df5e4f881484a88e106f7ee0436975d329d4c1ebf221d9a021d5e8a45f122d50', 'b9f03f3d2d99e2f7db9ea7428f9a68dc5584b60aa8cc261befabf62517780d06', ['3 credits', 3, 3, 'fd180116ad01f40493a561ad5409b85ab5e8829b2a6f37abdce9b1fff08a30a3'], [1, 0, 1, 2], 3, 'cc064492cc506f7dcdbc92b0a48916fb45bc0281dd2c7dbed78f404449b48f96'],
  CS105: ['cs', 1, 776, '00d00402cfe4241391371705859302b62dd4791784276a19ba4f7e8796d2add1', '228e395f862c6a7388025224d446bf950bad5a0402e4ff614b54e634ddbe2a44', ['1 credit', 1, 1, 'f24a2a074553176f9094d75305fc150a7c5ac8cfb243a7290cfca2fe7d0093b9'], [0, 0, 0, 2], 4, '526da97569e399029072002a634224148834768cecd1b97be475c84f592fc46c'],
  ELED258: ['eled', 2, 567, 'fa9dcfa4380ccee6867f0deba4c10f64777209e2b380aa94b4df3df5aa1e2878', 'ca3e50159ee377ca70cc460603d910a55b3511c6bb419864f79f43860c36994a', ['3 credits', 3, 3, '2171a9b7affcc15b4460ee3693f5224a8f97b491244e816201bdd987298515dc'], [1, 0, 1, 0], 2, 'bad18f4392b7a08516aaa13ae2c4d027522f2bce7db865ba9c0b310b6173bcd8'],
  ENGH122: ['engh', 3, 916, '948e3bc5c50a646edb6aa4c9c5410fe0d4fac6dfc0e4b2926bb5e4e3ddcf77ad', 'ac4672aa338250205173af8961db8c7cda6988e56293de629a7a8528279d0ac7', ['3 credits', 3, 3, '6448fdebe2a9b0b8eb4bef74d5796d59b805f42a817796d08eedfbe91c644a6a'], [1, 0, 1, 3], 4, '745b536e5909842a1b8c5ac79f53b143987164eb956f6cfd41979d994dcb497f'],
  ENGH123: ['engh', 4, 1310, '1e95899a0919e2c400f8f7def1f6954de67c9dfad4c5fb1161bc1ee063458c28', 'b02f657435487b88c8635e0664bbc711c7ac58c45cb3bc17d80e5d46b21deea9', ['4 credits', 4, 4, '3e8a63bf1dc261557805308683c122903e1ba0455718a1d1a131983a66be15b2'], [0, 0, 0, 4], 3, 'c0584877072644e864ccbc6603500b8c6fc99d87e04e35d870c99fbfbc377bf5'],
  ENGH201: ['engh', 5, 563, 'b62b36b62a0193585bffcc5d587bb4ceb6785aaff881b8a4ee51ae1fb79a5a8e', 'b5d1b9756e6a3941bacfa66070b0bbd278d941b43bad992708b118617b21cfcd', ['3 credits', 3, 3, '215663cf5eb72fcbf8bc6900352b4c7a9952308a011ca031f94848b23c56309f'], [1, 0, 1, 0], 2, '856b617b2f1375232b58e1841ae87f488b4fa75fa47abc40078aa1525ff0c158'],
  ENGH202: ['engh', 6, 547, 'f928a10d374ce872bdc2d9110c1d7cced58759f6bd1ce0f0a89d393c0bff4691', '56d0a0a2c683a269f38ca6ec6698a87dcad391499adabbbecc4e63e5d3273975', ['3 credits', 3, 3, '0985ed1f1c296d38facd23d3eb91c2ca112b6fdd1e536945345116ae2b7d388b'], [1, 0, 1, 0], 3, 'c75bf634bf82751b76fe2135bf49912ce6ad80bd2a5f4fba762a019b51e7e70f'],
  ENGH203: ['engh', 7, 544, '776d5d87a19d3494a22ded866aacb04c5379d10d86895c16e307178eba0b71f7', 'ae83b32f44903fe64177606ebc1dc5f6cf009b6919b51992c91f9e259d1a33fd', ['3 credits', 3, 3, '6f0b821effed2204fd637fb3a660a0cdbf7d7912f600a1004c0eea30bfb87177'], [1, 0, 1, 0], 3, '254b5d0c2518d5f07e67f97ec5556b870e315b334fbfc2ba84db0027805ae2a4'],
  ENGH204: ['engh', 8, 574, '97c9745c48becb6971ede0248353cc0b0b269d58a0639a476f45f0108a78a61f', '66bd979084deb412bf9628121df0f693cccc3b07bd4cd11219f4e81183f74f84', ['3 credits', 3, 3, 'cb65248e9ff51d31883aa6d7e0a2e0281db1b26fd5620f9a46b4d077b2de67f7'], [1, 0, 1, 0], 3, '6929db2924a62316e1d2955397d3074566befa6590fe9665bbbaf16d40d2c2a8'],
  ENGH206: ['engh', 9, 607, 'a1fd18f84afd604e3ee9c1b3a659d329411b05e704466dcac4ed57cb44996eaf', 'c4597a454f75e66a0b29ca0305fe71ddfd0b4315b6f6f7260e0492f1704dda29', ['3 credits', 3, 3, '00c6180e7fd0790463ac476595e752297acb031c17902695f13ecdb06966ee43'], [1, 0, 1, 0], 2, '9eab72ac0ace948dee4bedff7da22d18968a4d5a3ae9c90d70ef05c23406a421'],
  FREN325: ['fren', 10, 588, '60da4c82a0b777d580025a1a173d387b08821d334970da5f0636d89a66b05bd4', 'b61f24a95d32ecdf32d08baaa08435bce7d0bce8087ad78879e018aa027c03ce', ['3 credits', 3, 3, '8dd4d939cb6d27466d8749961e611a5fe02bda3df1d779076e1b0758e2fcca61'], [1, 0, 1, 2], 3, '01c8259422a2b5b1cf32ea3e8683cc5b5aa6bd8e5f2d88f65d9063e905ef4d25'],
  FREN329: ['fren', 11, 577, 'a171ceccc949ff8860d700627e35ebb2a756c6ac7136128dea61ee5d17eb5bfc', '2a7e99fe1b4d9e6047a394e4ab117fe33359358cc9c145bdba5b05bad0303e38', ['3 credits', 3, 3, '88a8ebb7883679505344d8d3d597c7e65d8c5322ae984a2d7a90969e1ec1af50'], [1, 0, 1, 2], 3, '01c8259422a2b5b1cf32ea3e8683cc5b5aa6bd8e5f2d88f65d9063e905ef4d25'],
  FRLN330: ['frln', 1, 624, 'c7932ac13e923e27f877c038e058659ba527f1d48ac813a85caa467f9dcbf2f0', '90d36e2010b094a781f09fa5e67ef62f557f87f9d65a5452481c165a50641265', ['3 credits', 3, 3, '349ae886c7b9fa711069f45c281099530b7f12ed1b14581813723a2ba46dc6c8'], [1, 0, 1, 2], 3, 'b059dd90836270db796df3c5f96b89ebb97c6acc753f2cbc45f84d47cfb2b9f5'],
  GERM325: ['germ', 11, 510, '4492dbf6ce0794ef3760441453ac07dcd97c83bd5fdb798f1637d834c65b3d08', 'e83216766c17155e22b9e873a787cb5a12da642307564bcd5a8f011d4e31ad31', ['3 credits', 3, 3, 'c005f6beb3507398754281b1727c245c0a1df734d146f92840a8095618b9c7a8'], [1, 0, 1, 2], 3, '9c46908e281223b6715819d6573c3939146e9d127fc11ea6add799c80c5e2d11'],
  HIST403: ['hist', 92, 414, '684a87cb9f2f8755d8b3f8ac9ec523fad6c236303953629defc33bc454b653d0', '3a2d0d78a2e23e37236a9435d8d2d5257867d956ee81d44798aef21999452975', ['3 credits', 3, 3, '2ad4a69ac8d8a37e1cbc1460a386a64ef4bb17e032907fae6f1d7840ad44dbbe'], [1, 0, 1, 1], 2, '04b2086ee4fe37726f7ab963213d235eb07aa7d58b700411f088f8b3a290883b'],
  HNRS310: ['hnrs', 7, 682, '32820714837bb8d9c32796cbb589b1221d51f0d21f0281f171e5e703b354f844', '230c8fa241025bbc8d8611f538a0ce3584b44f3f2905539bdc7ecbdbfefa5c6f', ['3 credits', 3, 3, '7d9debf85a253aef8900cfcef02072de7737c67be2b216fefbfdf25db42ae8d8'], [0, 0, 0, 3], 2, '8018bdccfde6b5deca7d026e15d3538de14085436150d56f3d09ed870a4a883d'],
  INTS101: ['ints', 0, 668, '8d39af96568c7788bffe962276e8c6d70813387dc74fab908c9f5145452afa29', '4d6ab36443dfbc813fc2d8077ab15fa4fe022b732dd1e0c0f226565e598f8f8f', ['6 credits', 6, 6, '2722bd9397526c88aeabc766bc2da82cde5a178bbe6605082721918dda67e1da'], [0, 0, 0, 2], 2, '36741120c7956945df5074ff3f69ccc187fc6353196c01189520a871da9a7b38'],
  ITAL320: ['ital', 5, 600, '255694d4d2988304795725d11e6fa630db29b5a4af119296628117f54fec95e1', 'e861960a031585159a50ff51c22928a79cbf2cf7bd6585849da70da0e011fa98', ['3 credits', 3, 3, '986cdcf76d1562077a427d50cc4e582d2c58a0391589b24c41aec94876d20cf5'], [1, 0, 1, 0], 2, '17578c69bfec5f04bbf82372da3efb69d57907890363ff8acdee6f846e9b526c'],
  ITAL325: ['ital', 6, 542, '384cbbbeff714f5bc1997bc0beaacbe71380cc9dab37b58dba6099fb7778a257', '8403fca1b50cf3f619901fb83321aaf87b94efbb85e35b8bd62d1483b3d00028', ['3 credits', 3, 3, '072e375558e863eb33e48128f9489d2f592d3f0df62a2faacadd319dc576e59c'], [1, 0, 1, 1], 3, '1daac4c45564192b537e2a52855ea4328fe078d31d3a4effbc7aea475288e87f'],
  JAPA340: ['japa', 10, 575, '29aa11ef4d107b501ebc38fe6af413dfddf5b14adb9e02f6b804d7c79a436609', 'cd3534f0f7cfd9948b3f1e41b5908d58965f95f85f6923c023c242103436a181', ['3 credits', 3, 3, '0b93a6836ff3bf5550a816bfbad79fac8b6c63f055183eb7ebd33f291b59d029'], [1, 0, 1, 2], 3, '2c61125e3f46a446e2167545c779589da51eeaa5629f5d1c5cff38dc23617255'],
  KORE311: ['kore', 9, 576, 'c9f19a08a4b0528e8b49b33c151a742750fda374a19aea9d07f0c3b0cbabf507', '012d3bffb6e2263a9e9b3f34cdb96d2a2821586ae125262d8470097e00de4b17', ['3 credits', 3, 3, '48969bdbf4efa2b5f14c9a8e9f45047870c5e6aaf9b1986bf9db3ff155ab3d52'], [1, 0, 1, 2], 2, '11f15e1ee312c9d6f92770fc9deaf72652070d2dba30554edee307c7f710cd01'],
  RELI338: ['reli', 24, 691, 'e92a91484e48ebc008bf4db78ad1196ca00fec94a60657bacc3bfc08f4b1447d', 'a3cfd59bafd96f38ad361c2e4eddd035fae9aa6e43eee7df954c6037d302a611', ['3 credits', 3, 3, '27f35a312ea5c383f4a42e303fa494fd1b7e1573a9a94e839acdf5219b7f7edb'], [1, 0, 1, 1], 2, '54cac490782f26e87e0e2d94b1bbcfb7163177b39149486c5a6c04c3d1e5aefb'],
  RUSS325: ['russ', 8, 557, 'dbb0d34ffc4188d93a9e0236b8a8c9cfeac3694b34cf0ba357c608f5fd6d314f', 'b9de05425bca979e362ff4833a687ce0b1003f42f2ff1d73ed5bf1e877b9ebf9', ['3 credits', 3, 3, '091d69337916fef701f8471bc5987c66ef390a70f718b0dd244cdc6b56805065'], [1, 0, 1, 1], 3, 'f27a77ca9bac89ef2be9be71b65c6f8ee9e8f3409e8653580985e69d04f56903'],
  RUSS326: ['russ', 9, 382, 'f763eb29aab02e6c2b3b3ac7b09ce2bebe8f29e0d2f02723ef84d104b473426a', '3cd7075f854289493f6d6f062c61cb77e6f2cd8ac720c96c106658ac9ca0428e', ['3 credits', 3, 3, 'aa459df72df1242bfff8466c833586f2f21f07cc45a31da065f48454c3bbfc77'], [1, 0, 1, 1], 2, 'f664add4ce01876ab6763aa1ec74c67307f735fb6f1b25a8cd77368883aa7497'],
  SPAN325: ['span', 17, 492, 'cb8834e33ae1e701ef4ea51c23b823bf3f4e02e51a17c687cb845f4b19fc7ec5', '2523db3701effbdf85c21bddd26c6934323b9e00f8bfaf5380e86ebe8eda0d71', ['3 credits', 3, 3, '4403e94aa9e6318ba7eaf3d7ecd03dceb94b18f2c4a114db70f82f7ac76b5b6d'], [1, 0, 1, 0], 3, '175f8d9ab110f3af5bda7c042a52cf078b5d42e7a034153f3b547d80211313a9'],
  STAT250: ['stat', 0, 576, '9468596189b10c81d70624a4f5501d6a92b0d75d67254f271697edb4f1d5f69d', '1f3768c2d78294dd6afe78fc61fa630c29f74fedd2bb2a014af13487e14c6ec6', ['3 credits', 3, 3, 'a248fa5183fa96fee47c082a66b43017aa9aa0a9b001d42ba5fdd5241a3a04cc'], [1, 0, 1, 0], 2, '2df6ba01c613f0057ffc0c3be0fc471058e6cff1f6ac56db96914245ab80fc8b'],
  SYST130: ['syst', 1, 1309, '7c744e8b3bb46326a90f29fd27f10c1bd97f1f1b3e1021f6e18963bccd295f10', '9671e6efffb151a2a862b489d589d7b5ce80d3ec9d7ac42e5c17cf30b4b29bb2', ['3 credits', 3, 3, '9bd2512cfc29fc5610c5eb90c9e26baa04a5936206459aaefe9965950e866085'], [1, 0, 1, 3], 4, 'a5ad708ec3a28db627c66e919d36c99cb4c2c4be5fdaac191c4e501ce7d46b1c'],
});

const CLOSURE_CODES = Object.freeze(Object.keys(ROWS));

const CYSE_PAGE = Object.freeze([
  'https://catalog.gmu.edu/courses/cyse/',
  'university-prerequisites/raw/george-mason-university/george-mason-university__cyse.html',
  'e1c6f3d40c65fe9b9c814891d34253bb9260e77575ca4e3b6c25cb6fd147eb23',
  168333, 70, 70, 42,
]);

const CYSE_ROWS = Object.freeze({
  CYSE101: [0, 755, 'eceaa71b8586ae177dcddac183d7d7f2a2f4bb383735c55e21f30ec1a8d37f54', 'e9b6a658b30d5052757c51bfdfb51af66a963495580ae517400693636efb45bc', ['3 credits', 3, 3, 'be5ff7243158f54f4213cfa265c8e2c97ad8c297b2bd393ffea6b1473e9a2c4a'], [0, 0, 0, 2], 2, 'dc170173a070b679aad8a0761eb342592bc0b4ecb33070c8dad415b8434d551f'],
  CYSE130: [1, 1305, 'd686c37681d5c24b59230295ec4915b9d056d5f62cfb342888722c93459bf47b', 'aa6d8a21317116d76d5319242053fabefda3095666f8a745d3534452b088fa43', ['3 credits', 3, 3, '8556aed4d24656af88b7cbdcea575cefdd33cf14d01f38f8298ea121a5c1adb3'], [1, 0, 1, 3], 4, '9a71395bec10937ba6cb234c2c055d3c00b9092fcf602b495546f157962636fe'],
});
const CACHE_REACQUIRE_CODES = Object.freeze(Object.keys(CYSE_ROWS));

// References whose exact current subject pages have no matching courseblock,
// or whose subject route is an exact cached 404. Neither condition proves
// prerequisite silence, so these remain blockers rather than guessed aliases.
const BLOCKER_PAGES = Object.freeze({
  cs: ['https://catalog.gmu.edu/courses/cs/', 'university-prerequisites/raw/george-mason-university/george-mason-university__cs.html', '5180e1335639e2e9d1778c0dd19d051ed3cce9e4035b6749597ab56cef4e5600', 222649, 103, 103, 95, ['CS101', 'CS421'], 'exact_current_subject_page_absence'],
  ece: ['https://catalog.gmu.edu/courses/ece/', 'university-prerequisites/raw/george-mason-university/george-mason-university__ece.html', 'be9819b8dcda2f3f7ccd700e923acd8277396e8a5b0cd4bf2ffae63ed09892a0', 388340, 178, 178, 148, ['ECE331', 'ECE332'], 'exact_current_subject_page_absence'],
  engl: ['https://catalog.gmu.edu/courses/engl/', 'university-prerequisites/raw/george-mason-university/george-mason-university__engl.html', '80c3fe2ae1062abf56456f52518bd670f9ec3917b7f85e152b347ac6b6faf880', 196, 0, 0, 0, ['ENGL100', 'ENGL101', 'ENGL122'], 'official_subject_route_http_404'],
  engr: ['https://catalog.gmu.edu/courses/engr/', 'university-prerequisites/raw/george-mason-university/george-mason-university__engr.html', '6bce5956377bd47ee1c57232d1d03297825da2d9a001a395ce3b929b8e8fe6c8', 31814, 8, 8, 3, ['ENGR125'], 'exact_current_subject_page_absence'],
  hnrs: ['https://catalog.gmu.edu/courses/hnrs/', 'university-prerequisites/raw/george-mason-university/george-mason-university__hnrs.html', '06275c40a82bb91e84898d7fde77ea997290a83d50983d5f2c4fd37b62abb1f7', 36519, 10, 10, 6, ['HNRS261', 'HNRS302'], 'exact_current_subject_page_absence'],
  hnrt: ['https://catalog.gmu.edu/courses/hnrt/', 'university-prerequisites/raw/george-mason-university/george-mason-university__hnrt.html', '80c3fe2ae1062abf56456f52518bd670f9ec3917b7f85e152b347ac6b6faf880', 196, 0, 0, 0, ['HNRT225'], 'official_subject_route_http_404'],
  math: ['https://catalog.gmu.edu/courses/math/', 'university-prerequisites/raw/george-mason-university/george-mason-university__math.html', '462a362c8deb2cf6275426dab87618b289b968818f3acc7dce4bd6f8ae1366e0', 244695, 143, 143, 113, ['MATH103'], 'exact_current_subject_page_absence'],
  nclc: ['https://catalog.gmu.edu/courses/nclc/', 'university-prerequisites/raw/george-mason-university/george-mason-university__nclc.html', '80c3fe2ae1062abf56456f52518bd670f9ec3917b7f85e152b347ac6b6faf880', 196, 0, 0, 0, ['NCLC101', 'NCLC203'], 'official_subject_route_http_404'],
  reli: ['https://catalog.gmu.edu/courses/reli/', 'university-prerequisites/raw/george-mason-university/george-mason-university__reli.html', '51826bec3c85348f61bb07a2ee7f7336e870369a6f0024ab6252c20cc182be0c', 102972, 72, 72, 16, ['RELI271'], 'exact_current_subject_page_absence'],
  swe: ['https://catalog.gmu.edu/courses/swe/', 'university-prerequisites/raw/george-mason-university/george-mason-university__swe.html', '45080cfa88f9f8cace66be06e358f2c2e28fa23b1fe6821a761c97fc2985548a', 69333, 27, 27, 26, ['SWE321', 'SWE421'], 'exact_current_subject_page_absence'],
});

const BLOCKED_CODES = Object.freeze(Object.values(BLOCKER_PAGES).flatMap((row) => row[7]));
const OUTSIDE_CODES = Object.freeze([...CACHE_REACQUIRE_CODES, ...BLOCKED_CODES].sort());

// Exact hashes/counts of every parsed formula that refers to one of the 19
// outside-scope codes. This makes the audit detect dropping, aliasing, or
// changing an OR/AND expansion while closing terminal nodes.
const FORMULA_ROWS = Object.freeze({
  CS262: ['direct', '873b68ca3086b8b9bd0daec0f199f5e9a82027362dfe50647986dc32920644f4', 'be4b8dbbdf52d210de0f91c4221f7d1132bc186e75c0007cd578cb28fa344c1d', 1, 4, 8, { CS101: 2 }],
  CS321: ['direct', 'ea9879ab961aa167957c32ce24b762f1863db000a7fcb235ae9252694fb955fb', '613737ce1b5061b4f185a59264c87a0be4e1a8c10f0fea61781f7c93398d9a0b', 1, 3, 6, { HNRS261: 1 }],
  CS405: ['direct', 'dcc41b31e928185222a6e6a108a9f201a461db08f5c6d24a259ae5cf369adb3e', 'c1d26d7311b0411d0207387c4e4a787842c701a47e6906b43feb5084a826c532', 1, 8, 20, { HNRS261: 2 }],
  ECE445: ['direct', '30a6b899c1615dacda2f1c7eede3c4fa321444053a351d7a9a3cdc4ea52bebaa', '5ceeabb2102e8f156204dfe583328d0ba15032e875a5d1b6ec2e9095387bf2c0', 1, 12, 36, { ECE331: 6, ECE332: 6 }],
  ENGH302: ['direct', 'b27746f52d4424ac593e79205189f33de4213e7d96d6a71105fe9c1031a0fa62', '9e954655052b0115dd02be72df86d130a7ea20e18bd9494aae59e3a3b28fbef8', 1, 490, 980, { NCLC101: 10, RELI271: 10, ENGL100: 49, ENGL101: 49, ENGL122: 49, NCLC203: 49 }],
  MATH125: ['direct', 'dd0bc76685f232726957bb89571e0da4e6d8c2fd75c9aef7b124b3d58feac1eb', 'd727eb624c47ba7dd20507e847d8109bfe36e8e209913bd9ac11d1041d458fa7', 1, 7, 7, { MATH103: 1 }],
  OR335: ['direct', 'ea535c5145c1f1f3cc23fa1492b2de9ad473451a26bfc1e9d38bbe9823fcdf66', 'beb0c2a0c6655a1b1240779e0fc7410dde740ff2a4180a08f84ac86a62a764f4', 1, 32, 96, { ENGR125: 8 }],
  OR481: ['direct', 'ca89f34fdf57795f2e4e8c8b407fe9004f5de0bdf7120783bae447f810aa6c4d', '6bfec2a91a1b42b0c51fbd07e8028c2999f1f539eed88d9f88f8f95e4d2b4437', 1, 4, 8, { ENGR125: 1 }],
  SWE443: ['direct', '0607bfb5aac347d7f1d549958c96da0232dacce42d200b3d802a6956ffadb045', 'acffacf5f2f2706a5c5999c5248d1bbd9e75f341deff833c93e6ed19bfaff07d', 1, 4, 4, { CS421: 1, SWE321: 1, SWE421: 1 }],
  HNRS131: ['closure', 'bca22ca0d33d5f2d1c15b9b9ad211e236af7cef3daeab2f5d8a94f23da10830d', 'b466772a49004c07c6d8374b1767356351888c7a5ad6f73e1e3456fd48ccd6e1', 1, 3, 3, { HNRS302: 1 }],
  HNRS260: ['closure', '9f314b2a63d2f238c89b9b2f09681e9a52aa041b30a6215e451aae736c6b4336', '916e2d06000328af6d7af51e39907defdde50b997082d8f13678fe47527d6d69', 1, 3, 3, { HNRS302: 1 }],
  IT102: ['closure', '307bf53cae898d3643b22259743cc62bdc022fc3f057329965b9307a6e2860e5', '2e3a852bdafcdde879ef883e245fb6ef4221db8357760a551de4a76551548338', 1, 4, 5, { HNRT225: 1 }],
  MATH104: ['closure', 'e9d15658a6110fcf3c0f8a8a1ab79423b79b507f44230a70d992d01bb0800de4', 'b661df752d44915dbc605707cec3035a9546820407a5ba3596ef23d4dd6925c8', 1, 2, 2, { MATH103: 1 }],
  MATH105: ['closure', 'e19b61c71a77138e06fa0d22a5d3ddfdd5c421c5da73c52ed2527f276e288420', '8da77424e1d60c4dba15556de797efe8066b5cee727be0e9a9ddf9b4726f056a', 1, 2, 2, { MATH103: 1 }],
  MATH108: ['closure', '1e26ee7e32ab1c09c3c64702de8e6a1cc6b880782a2545ff994b290de9031685', '47d6810b94cfc8105e5ad5c8bbb57c85885c6336865e0d59056ed3beeb1c6353', 1, 2, 2, { MATH103: 1 }],
  ME151: ['closure', 'ea26ccd3581bb46674e3107a82f61c3bdeff5f6e007d4300e4a8852aabe56513', 'af4afdbad54cd9aafe981b47149e005b27d788b5a59e23a55d77de5ac9e719b0', 1, 9, 18, { ENGR125: 3 }],
  SYST205: ['closure', '6e7677678cdf40bac1cf485b5bfc9575c95a7fe2790c03f02f4355e5753fac96', '34656e1380fab813e9a7111eb49ed463bdb3ec3f82b91904e997f41a91158131', 1, 1, 1, { CYSE101: 1 }],
  SYST210: ['closure', '5ec17f14729e0d5272543beb05e95ff559cc01689636557cb686b2867953a601', '11eef4669385707dd4b8caaa735609f5ba9f42c9968c5542a6031e779069d0b4', 1, 5, 5, { CYSE130: 1, ENGR125: 1 }],
  SYST230: ['closure', 'ec3b5845e28b827247865c4c44e52efcdab8b63e43ba96f9729fd0fb54a3cad3', '550bdac429f73b0ceb8f5da980e3c835d101ead05d5aec33512bc11b387fc05b', 1, 10, 20, { CYSE130: 2, ENGR125: 2 }],
});

const SIGNAL_PATTERNS = Object.freeze([
  ['recommended_prerequisite', /Recommended Prerequisite:\s*.*?(?=Registration Restrictions:|Schedule Type:|Grading:|Additional Course Details:|$)/g],
  ['recommended_corequisite', /Recommended Corequisite:\s*.*?(?=Registration Restrictions:|Schedule Type:|Grading:|Additional Course Details:|$)/g],
  ['registration_restrictions', /Registration Restrictions:\s*.*?(?=Schedule Type:|Grading:|Additional Course Details:|$)/g],
  ['attempt_approval', /A third attempt will require academic advisor approval\./g],
  ['attempt_limit', /Limited to (?:two|three) attempts\./g],
  ['repeat_restriction', /May (?:not )?be repeated(?: for credit| within the (?:degree|term)(?: for a maximum \d+ credits)?| when topic (?:is different|differs) with (?:permission|approval) of department| for credit (?:with permission of department|when (?:course content|topic) is different))?\./g],
  ['equivalence', /Equivalent to .*?(?=Mason Core:|Specialized Designation:|Recommended Prerequisite:|Registration Restrictions:|Schedule Type:|Grading:|Additional Course Details:|$)/g],
  ['degree_grade', /(?:Students must attain minimum grade of C- to fulfill Mason Core degree requirement for written communication \(lower level\)|Min\. grade of C- required to meet degree requirement)\./g],
  ['anti_credit', /Note: Students who have received credit for CS 305 or 306 should not register for CS 105\./g],
  ['anti_credit', /No credit will be given for CS 105 if a student has already received credit for CS 305 or 306\./g],
  ['background_note', /Knowledge of (?:Arabic|Chinese|Asian languages) (?:helpful but )?not required\./g],
  ['background_recommendation', /The class is taught in English, but some knowledge of Arabic is recommended\./g],
  ['background_note', /Notes: Coursework in English\./g],
  ['background_note', /Notes: All readings are in modern English\./g],
  ['background_note', /Notes: Courses build on reading and writing skills taught in ENGH 101\./g],
  ['background_note', /Notes: Builds on reading and writing skills taught in ENGH 101\./g],
]);

const SIGNAL_MARKER = /(?:Recommended (?:Pre|Co)requisite:|\brecommended\b|Registration Restrictions:|\bEnrollment\b|may not enroll|minimum grade|Equivalent to|should not register|No credit will be given|Limited to (?:two|three) attempts|A third attempt|May (?:not )?be repeated|not required|permission of (?:department|instructor)|approval of department|builds on reading and writing skills|must attain minimum grade|grade of C- required)/gi;
const REQUIRED_LABEL = /Required\s+(?:Pre|Co)-?requisites?\s*:/gi;
const UNQUALIFIED_LABEL = /(?:^|[^A-Za-z])((?:Pre|Co)-?requisites?\s*:)/gi;

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function pageReceipt(tuple) {
  const [officialUrl, cachePath, responseHash, bytes, blocks, complete, positive] = tuple;
  return {
    official_url: officialUrl,
    cache_path: cachePath,
    source_response_sha256: responseHash,
    source_response_bytes: bytes,
    source_courseblock_count: blocks,
    source_complete_entry_count: complete,
    source_positive_control_count: positive,
  };
}

function rowReceipt(tuple) {
  const [page, index, length, rawHash, htmlHash, units, markers, signalCount,
    signalHash] = tuple;
  return {
    page,
    courseblock_index: index,
    entry_length: length,
    raw_entry_sha256: rawHash,
    raw_entry_html_sha256: htmlHash,
    published_units: {
      kind: units[1] === units[2]
        ? 'published_fixed_credits' : 'published_variable_credit_range',
      notation: units[0],
      credit_hours_min: units[1],
      credit_hours_max: units[2],
      heading_text_sha256: units[3],
    },
    marker_counts: markers,
    signal_count: signalCount,
    signal_sha256: signalHash,
  };
}

function expectedCompleteEntryReceipt(page, row) {
  return {
    receipt_contract: RECEIPT,
    source_courseblock_count: page.source_courseblock_count,
    source_complete_entry_count: page.source_complete_entry_count,
    source_complete_entries_with_required_requisite_marker_count:
      page.source_positive_control_count,
    entry_required_requisite_marker_count: row.marker_counts[0],
    entry_corequisite_marker_count: row.marker_counts[1],
    entry_requisite_marker_like_count: row.marker_counts[2],
    entry_constraint_like_signal_count: row.marker_counts[3],
    same_source_positive_control: true,
  };
}

function unqualifiedFormalLabels(text) {
  return [...String(text || '').matchAll(UNQUALIFIED_LABEL)].filter((match) => {
    const prefix = String(text).slice(Math.max(0, match.index - 20), match.index + 1);
    return !/(?:Required|Recommended)\s*$/i.test(prefix);
  });
}

function nonrequiredSignals(text) {
  const source = String(text || '');
  const rows = [];
  for (const [kind, pattern] of SIGNAL_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) rows.push({
      kind,
      raw: match[0],
      raw_sha256: sha256(match[0]),
      relative_start: match.index,
      relative_end: match.index + match[0].length,
      required_prerequisite_graph_edge_emitted: false,
    });
  }
  rows.sort((left, right) => (
    left.relative_start - right.relative_start || left.kind.localeCompare(right.kind)
  ));
  const markerMatches = [...source.matchAll(SIGNAL_MARKER)];
  const unaccounted = markerMatches.filter((match) => !rows.some((row) => (
    match.index >= row.relative_start
      && match.index + match[0].length <= row.relative_end
  ))).map((match) => ({ raw: match[0], relative_start: match.index }));
  return {
    rows,
    marker_count: markerMatches.length,
    unaccounted,
    digest: sha256(JSON.stringify(rows.map(({ kind, raw }) => ({ kind, raw })))),
  };
}

function sourceIssues({ code, source, page, row }) {
  const issues = [];
  const require = (condition, issue) => { if (!condition) issues.push(issue); };
  require(source?.official_url === page.official_url, 'official_url');
  require(source?.capture_origin === 'official_acquisition', 'capture_origin');
  require(source?.source_format === 'courseleaf_courseblock', 'source_format');
  require(source?.boundary_contract === BOUNDARY, 'boundary_contract');
  require(source?.catalog_year_verified === CATALOG_YEAR, 'catalog_year');
  require(source?.cache_path === page.cache_path, 'cache_path');
  require(source?.source_response_sha256 === page.source_response_sha256
    && source?.declared_normalized_text_sha256 === page.source_response_sha256
    && source?.retained_normalized_text_sha256 === page.source_response_sha256,
  'source_response_sha256');
  require(source?.source_response_bytes === page.source_response_bytes,
    'source_response_bytes');
  require(source?.courseblock_index === row.courseblock_index, 'courseblock_index');
  require(source?.character_start === 0
    && source?.character_end === row.entry_length
    && source?.raw_entry_text?.length === row.entry_length,
  'entry_boundary');
  require(source?.raw_entry_sha256 === row.raw_entry_sha256
    && sha256(source?.raw_entry_text || '') === row.raw_entry_sha256,
  'raw_entry');
  require(source?.raw_entry_html_sha256 === row.raw_entry_html_sha256,
    'raw_entry_html_sha256');
  require(same(source?.published_units, row.published_units), 'published_units');
  require(same(source?.complete_entry_receipt,
    expectedCompleteEntryReceipt(page, row)), 'complete_entry_receipt');
  require(same(source?.structured_requisite_fields, []), 'structured_requisite_fields');
  require((String(source?.raw_entry_text || '').match(REQUIRED_LABEL) || []).length === 0,
    'required_label_present');
  require(unqualifiedFormalLabels(source?.raw_entry_text).length === 0,
    'unqualified_requisite_label_present');
  const signals = nonrequiredSignals(source?.raw_entry_text);
  require(signals.unaccounted.length === 0, 'unaccounted_nonrequired_signal');
  require(signals.rows.length === row.signal_count, 'nonrequired_signal_count');
  require(signals.digest === row.signal_sha256, 'nonrequired_signal_digest');
  return { issues: [...new Set(issues)], signals };
}

function closureReviewRowIssues(reviewRow) {
  const code = normalizeCode(reviewRow?.code || reviewRow?.course_code);
  const tuple = ROWS[code];
  if (!tuple) return ['not_scoped'];
  const row = rowReceipt(tuple);
  const page = pageReceipt(PAGES[row.page]);
  const source = {
    official_url: reviewRow?.review_evidence?.official_url,
    capture_origin: reviewRow?.review_evidence?.capture_origin,
    source_format: reviewRow?.review_evidence?.source_format,
    boundary_contract: reviewRow?.review_evidence?.boundary_contract,
    catalog_year_verified: reviewRow?.review_evidence?.catalog_year_verified,
    cache_path: reviewRow?.review_evidence?.cache_path,
    source_response_sha256: reviewRow?.review_evidence?.source_response_sha256,
    source_response_bytes: reviewRow?.review_evidence?.source_response_bytes,
    declared_normalized_text_sha256:
      reviewRow?.review_evidence?.declared_normalized_text_sha256,
    retained_normalized_text_sha256:
      reviewRow?.review_evidence?.retained_normalized_text_sha256,
    courseblock_index: reviewRow?.review_evidence?.courseblock_index,
    character_start: reviewRow?.review_evidence?.entry_character_start,
    character_end: reviewRow?.review_evidence?.entry_character_end,
    raw_entry_sha256: reviewRow?.review_evidence?.raw_entry_sha256,
    raw_entry_text: reviewRow?.review_evidence?.raw_entry_text,
    raw_entry_html_sha256: reviewRow?.review_evidence?.raw_entry_html_sha256,
    published_units: reviewRow?.review_evidence?.published_units,
    complete_entry_receipt: reviewRow?.review_evidence?.complete_entry_receipt,
    structured_requisite_fields: reviewRow?.review_evidence?.structured_requisite_fields,
  };
  const { issues } = sourceIssues({ code, source, page, row });
  if (reviewRow?.school_id !== SCHOOL_ID) issues.push('school_id');
  if (reviewRow?.slug !== SLUG) issues.push('slug');
  if (reviewRow?.owner_namespace !== OWNER) issues.push('owner_namespace');
  if (reviewRow?.course_key !== `${OWNER}:${code}`) issues.push('course_key');
  if (reviewRow?.source_content_sha256 !== row.raw_entry_sha256
      || reviewRow?.source_evidence?.content_sha256 !== row.raw_entry_sha256
      || reviewRow?.source_evidence?.raw_text !== source.raw_entry_text) {
    issues.push('review_source_binding');
  }
  if (reviewRow?.raw_requisites !== null
      || !Array.isArray(reviewRow?.groups) || reviewRow.groups.length !== 0) {
    issues.push('unexpected_required_formula');
  }
  return [...new Set(issues)];
}

function closureResolution(reviewRow) {
  const code = normalizeCode(reviewRow?.code || reviewRow?.course_code);
  const issues = closureReviewRowIssues(reviewRow);
  if (issues.length) return { applicable: ROWS[code] != null, ready: false, issues };
  const row = rowReceipt(ROWS[code]);
  const page = pageReceipt(PAGES[row.page]);
  const signals = nonrequiredSignals(reviewRow.review_evidence.raw_entry_text).rows;
  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    review_status: 'promoted_structural_none',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: signals,
    structural_none_evidence: {
      contract: CONTRACT,
      kind: 'official_complete_gmu_courseleaf_entry_required_requisite_silence',
      finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
      literal_none_statement: false,
      owner_namespace: OWNER,
      course_key: `${OWNER}:${code}`,
      catalog_year: CATALOG_YEAR,
      source_url: page.official_url,
      source_cache_path: page.cache_path,
      source_response_sha256: page.source_response_sha256,
      raw_entry_sha256: row.raw_entry_sha256,
      raw_entry_html_sha256: row.raw_entry_html_sha256,
      courseblock_index: row.courseblock_index,
      marker_control: expectedCompleteEntryReceipt(page, row),
      nonrequired_signal_count: signals.length,
      nonrequired_signals: signals,
      content_accounting: {
        full_entry_sha256: row.raw_entry_sha256,
        every_reviewed_nonrequired_signal_marker_accounted_for: true,
        source_content_discarded: false,
      },
      inference_boundary:
        'none means no required prerequisite/corequisite edge in this exact entry; recommendations and every reviewed nonrequired constraint remain audit evidence',
    },
  };
}

function absoluteSignals(reviewRow, rows) {
  const entryStart = reviewRow?.review_evidence?.entry_character_start;
  return rows.map((row) => ({
    ...row,
    source_character_start: entryStart + row.relative_start,
    source_character_end: entryStart + row.relative_end,
  }));
}

function closureResolutionRowIssues(reviewRow) {
  const code = normalizeCode(reviewRow?.code || reviewRow?.course_code);
  if (!ROWS[code] || reviewRow?.owner_namespace !== OWNER) return [];
  const issues = [];
  const resolved = closureResolution({
    ...reviewRow,
    raw_requisites: null,
    groups: [],
  });
  if (!resolved.ready) return ['source_receipt'];
  if (reviewRow?.status !== 'none'
      || reviewRow?.review_status !== resolved.review_status
      || reviewRow?.review_reason !== resolved.review_reason
      || reviewRow?.raw_requisites !== null
      || !Array.isArray(reviewRow?.groups) || reviewRow.groups.length !== 0) {
    issues.push('review_status');
  }
  if (!same(reviewRow?.ignored_nonrequired_requisites,
    absoluteSignals(reviewRow, resolved.ignored_nonrequired_requisites))) {
    issues.push('nonrequired_signals');
  }
  if (!same(reviewRow?.structural_none_evidence,
    resolved.structural_none_evidence)) issues.push('structural_none_evidence');
  return issues;
}

function pageFileIssues(tuple, bytes, metadata, { allowBlockedMetadata = false } = {}) {
  const page = pageReceipt(tuple);
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes || ''));
  const issues = [];
  if (sha256(body) !== page.source_response_sha256) issues.push('source_response_sha256');
  if (body.length !== page.source_response_bytes) issues.push('source_response_bytes');
  if (metadata?.requested_url !== page.official_url
      || metadata?.final_url !== page.official_url) issues.push('official_url');
  if (metadata?.http_status !== 200
      || !String(metadata?.content_type || '').toLowerCase().includes('text/html')) {
    issues.push('http_response');
  }
  if (metadata?.content_sha256 !== page.source_response_sha256
      || metadata?.byte_length !== page.source_response_bytes) issues.push('metadata_hash');
  if (!allowBlockedMetadata && metadata?.capture_status !== 'official_html_captured') {
    issues.push('capture_status');
  }
  if (!catalogYearSeen(body.toString('utf8'), CATALOG_YEAR)) issues.push('catalog_year');
  if (browserDocumentLooksLikeInterstitial(body.toString('utf8'))) issues.push('interstitial');
  return issues;
}

function cachedCyseResolution(codeValue, bytes, metadata) {
  const code = normalizeCode(codeValue);
  if (!CYSE_ROWS[code]) return { applicable: false, ready: false, issues: ['not_scoped'] };
  const issues = pageFileIssues(CYSE_PAGE, bytes, metadata, { allowBlockedMetadata: true });
  if (metadata?.capture_status !== 'blocked_fail_closed'
      || metadata?.blocked_reason
        !== 'response_failed_status_content_type_or_interstitial_check') {
    issues.push('pinned_prior_capture_disposition');
  }
  const page = pageReceipt(CYSE_PAGE);
  const extracted = extractCourseLeafEntries(bytes, CACHE_REACQUIRE_CODES);
  if (extracted.courseblock_count !== page.source_courseblock_count
      || extracted.complete_entry_count !== page.source_complete_entry_count
      || extracted.complete_entries_with_required_requisite_marker_count
        !== page.source_positive_control_count
      || extracted.missing.length || extracted.ambiguous.length) {
    issues.push('complete_page_extraction');
  }
  const entry = extracted.entries.find((candidate) => candidate.course_code === code);
  const fixed = CYSE_ROWS[code];
  const row = rowReceipt(['cyse', ...fixed]);
  const source = entry ? {
    official_url: page.official_url,
    capture_origin: 'official_acquisition',
    source_format: 'courseleaf_courseblock',
    boundary_contract: BOUNDARY,
    catalog_year_verified: CATALOG_YEAR,
    cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    declared_normalized_text_sha256: page.source_response_sha256,
    retained_normalized_text_sha256: page.source_response_sha256,
    courseblock_index: entry.courseblock_index,
    character_start: 0,
    character_end: entry.raw_entry_text.length,
    raw_entry_sha256: entry.raw_entry_sha256,
    raw_entry_text: entry.raw_entry_text,
    raw_entry_html_sha256: entry.raw_entry_html_sha256,
    published_units: entry.published_units,
    complete_entry_receipt: entry.complete_entry_receipt,
    structured_requisite_fields: entry.structured_requisite_fields,
  } : null;
  const result = sourceIssues({ code, source, page, row });
  issues.push(...result.issues);
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)],
  };
  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    ignored_nonrequired_requisites: result.signals.rows,
    structural_none_evidence: {
      contract: CONTRACT,
      kind: 'safe_cache_only_courseleaf_reacquisition',
      finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
      literal_none_statement: false,
      prior_capture_disposition_revalidated: 'blocked_fail_closed',
      network_request_used: false,
      owner_namespace: OWNER,
      course_key: `${OWNER}:${code}`,
      catalog_year: CATALOG_YEAR,
      source_url: page.official_url,
      source_cache_path: page.cache_path,
      source_response_sha256: page.source_response_sha256,
      source_response_bytes: page.source_response_bytes,
      raw_entry_sha256: row.raw_entry_sha256,
      raw_entry_html_sha256: row.raw_entry_html_sha256,
      courseblock_index: row.courseblock_index,
      marker_control: expectedCompleteEntryReceipt(page, row),
      nonrequired_signal_count: result.signals.rows.length,
      nonrequired_signals: result.signals.rows,
      content_accounting: {
        full_entry_sha256: row.raw_entry_sha256,
        every_reviewed_nonrequired_signal_marker_accounted_for: true,
        source_content_discarded: false,
      },
    },
  };
}

function cachedCyseReacquisitionReceipt(bytes, metadata) {
  const resolutions = CACHE_REACQUIRE_CODES.map((code) => (
    cachedCyseResolution(code, bytes, metadata)
  ));
  const issues = [...new Set(resolutions.flatMap((row) => row.issues || []))];
  if (resolutions.some((row) => !row.ready)) return { ready: false, issues };
  const page = pageReceipt(CYSE_PAGE);
  return {
    ready: true,
    issues: [],
    receipt: {
      contract: CACHE_REACQUISITION_RECEIPT,
      prior_capture_disposition_revalidated: 'blocked_fail_closed',
      prior_blocked_reason_revalidated:
        'response_failed_status_content_type_or_interstitial_check',
      network_request_used: false,
      source_url: page.official_url,
      source_cache_path: page.cache_path,
      source_response_sha256: page.source_response_sha256,
      source_response_bytes: page.source_response_bytes,
      exact_entry_codes: [...CACHE_REACQUIRE_CODES],
      exact_entries_revalidated: true,
    },
  };
}

function cachedCyseReviewResolution(reviewRow) {
  const code = normalizeCode(reviewRow?.code || reviewRow?.course_code);
  if (!CYSE_ROWS[code] || reviewRow?.owner_namespace !== OWNER) {
    return { applicable: false, ready: false, issues: [] };
  }
  const fixed = rowReceipt(['cyse', ...CYSE_ROWS[code]]);
  const page = pageReceipt(CYSE_PAGE);
  const source = {
    official_url: reviewRow?.review_evidence?.official_url,
    capture_origin: reviewRow?.review_evidence?.capture_origin,
    source_format: reviewRow?.review_evidence?.source_format,
    boundary_contract: reviewRow?.review_evidence?.boundary_contract,
    catalog_year_verified: reviewRow?.review_evidence?.catalog_year_verified,
    cache_path: reviewRow?.review_evidence?.cache_path,
    source_response_sha256: reviewRow?.review_evidence?.source_response_sha256,
    source_response_bytes: reviewRow?.review_evidence?.source_response_bytes,
    declared_normalized_text_sha256:
      reviewRow?.review_evidence?.declared_normalized_text_sha256,
    retained_normalized_text_sha256:
      reviewRow?.review_evidence?.retained_normalized_text_sha256,
    courseblock_index: reviewRow?.review_evidence?.courseblock_index,
    character_start: reviewRow?.review_evidence?.entry_character_start,
    character_end: reviewRow?.review_evidence?.entry_character_end,
    raw_entry_sha256: reviewRow?.review_evidence?.raw_entry_sha256,
    raw_entry_text: reviewRow?.review_evidence?.raw_entry_text,
    raw_entry_html_sha256: reviewRow?.review_evidence?.raw_entry_html_sha256,
    published_units: reviewRow?.review_evidence?.published_units,
    complete_entry_receipt: reviewRow?.review_evidence?.complete_entry_receipt,
    structured_requisite_fields: reviewRow?.review_evidence?.structured_requisite_fields,
  };
  const result = sourceIssues({ code, source, page, row: fixed });
  const expectedReceipt = {
    contract: CACHE_REACQUISITION_RECEIPT,
    prior_capture_disposition_revalidated: 'blocked_fail_closed',
    prior_blocked_reason_revalidated:
      'response_failed_status_content_type_or_interstitial_check',
    network_request_used: false,
    source_url: page.official_url,
    source_cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    exact_entry_codes: [...CACHE_REACQUIRE_CODES],
    exact_entries_revalidated: true,
  };
  const issues = [...result.issues];
  if (!same(reviewRow?.review_evidence?.cache_reacquisition_receipt,
    expectedReceipt)) issues.push('cache_reacquisition_receipt');
  if (reviewRow?.school_id !== SCHOOL_ID || reviewRow?.slug !== SLUG
      || reviewRow?.course_key !== `${OWNER}:${code}`) issues.push('identity');
  if (reviewRow?.source_content_sha256 !== fixed.raw_entry_sha256
      || reviewRow?.source_evidence?.content_sha256 !== fixed.raw_entry_sha256
      || reviewRow?.source_evidence?.raw_text !== source.raw_entry_text) {
    issues.push('review_source_binding');
  }
  if (issues.length) return {
    applicable: true,
    ready: false,
    issues: [...new Set(issues)],
    review_reason: 'gmu_cached_cyse_exact_receipt_changed',
  };
  const structural = {
    contract: CONTRACT,
    kind: 'safe_cache_only_courseleaf_reacquisition',
    finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
    literal_none_statement: false,
    prior_capture_disposition_revalidated: 'blocked_fail_closed',
    network_request_used: false,
    owner_namespace: OWNER,
    course_key: `${OWNER}:${code}`,
    catalog_year: CATALOG_YEAR,
    source_url: page.official_url,
    source_cache_path: page.cache_path,
    source_response_sha256: page.source_response_sha256,
    source_response_bytes: page.source_response_bytes,
    raw_entry_sha256: fixed.raw_entry_sha256,
    raw_entry_html_sha256: fixed.raw_entry_html_sha256,
    courseblock_index: fixed.courseblock_index,
    marker_control: expectedCompleteEntryReceipt(page, fixed),
    nonrequired_signal_count: result.signals.rows.length,
    nonrequired_signals: result.signals.rows,
    content_accounting: {
      full_entry_sha256: fixed.raw_entry_sha256,
      every_reviewed_nonrequired_signal_marker_accounted_for: true,
      source_content_discarded: false,
    },
  };
  return {
    applicable: true,
    ready: true,
    issues: [],
    status: 'none',
    raw_requisites: null,
    groups: [],
    review_status: 'promoted_structural_none',
    review_reason: REVIEW_REASON,
    ignored_nonrequired_requisites: result.signals.rows,
    structural_none_evidence: structural,
  };
}

function cachedCyseResolutionRowIssues(reviewRow) {
  const code = normalizeCode(reviewRow?.code || reviewRow?.course_code);
  if (!CYSE_ROWS[code] || reviewRow?.owner_namespace !== OWNER) return [];
  const resolved = cachedCyseReviewResolution({
    ...reviewRow,
    raw_requisites: null,
    groups: [],
  });
  if (!resolved.ready) return ['source_receipt'];
  const issues = [];
  if (reviewRow?.status !== 'none'
      || reviewRow?.review_status !== resolved.review_status
      || reviewRow?.review_reason !== resolved.review_reason
      || reviewRow?.raw_requisites !== null
      || !Array.isArray(reviewRow?.groups) || reviewRow.groups.length !== 0) {
    issues.push('review_status');
  }
  if (!same(reviewRow?.ignored_nonrequired_requisites,
    absoluteSignals(reviewRow, resolved.ignored_nonrequired_requisites))) {
    issues.push('nonrequired_signals');
  }
  if (!same(reviewRow?.structural_none_evidence,
    resolved.structural_none_evidence)) issues.push('structural_none_evidence');
  return issues;
}

function blockerForCode(codeValue) {
  const code = normalizeCode(codeValue);
  const found = Object.entries(BLOCKER_PAGES).find(([, tuple]) => tuple[7].includes(code));
  return found ? { page_id: found[0], tuple: found[1] } : null;
}

function blockedOutsideReferenceAudit(codeValue, bytes, metadata) {
  const code = normalizeCode(codeValue);
  const found = blockerForCode(code);
  if (!found) return { applicable: false, verified: false, issues: ['not_scoped'] };
  const [url, cachePath, hash, length, blocks, complete, positive, codes, reason] = found.tuple;
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes || ''));
  const issues = [];
  if (sha256(body) !== hash || body.length !== length) issues.push('source_response');
  if (metadata?.requested_url !== url || metadata?.final_url !== url) issues.push('official_url');
  if (metadata?.content_sha256 !== hash || metadata?.byte_length !== length) {
    issues.push('metadata_hash');
  }
  if (reason === 'official_subject_route_http_404') {
    if (metadata?.http_status !== 404 || metadata?.capture_status !== 'blocked_fail_closed') {
      issues.push('expected_http_404');
    }
  } else {
    if (metadata?.http_status !== 200
        || metadata?.capture_status !== 'official_html_captured'
        || !catalogYearSeen(body.toString('utf8'), CATALOG_YEAR)
        || browserDocumentLooksLikeInterstitial(body.toString('utf8'))) {
      issues.push('complete_current_subject_page');
    }
    const extracted = extractCourseLeafEntries(body, codes);
    if (extracted.courseblock_count !== blocks
        || extracted.complete_entry_count !== complete
        || extracted.complete_entries_with_required_requisite_marker_count !== positive
        || !same(extracted.missing, [...codes].sort())
        || extracted.ambiguous.length || extracted.entries.length) {
      issues.push('exact_entry_absence');
    }
  }
  return {
    applicable: true,
    verified: issues.length === 0,
    issues: [...new Set(issues)],
    status: 'blocked',
    course_key: `${OWNER}:${code}`,
    blocker_reason: reason,
    source_url: url,
    source_cache_path: cachePath,
    source_response_sha256: hash,
    inference_boundary:
      'an absent current courseblock or 404 subject route does not prove that a historical/transfer-recognized course had no prerequisite; no alias or none row may be invented',
  };
}

function outsideFormulaIssues(review) {
  const issues = [];
  const direct = new Map((review?.direct_review_rows || []).filter((row) => (
    row.owner_namespace === OWNER
  )).map((row) => [row.code, row]));
  const closure = new Map((review?.closure_review_rows || []).filter((row) => (
    row.owner_namespace === OWNER
  )).map((row) => [row.code, row]));
  const actualOutside = (review?.closure?.unresolved_outside_direct_scope || [])
    .filter((key) => key.startsWith(`${OWNER}:`))
    .map((key) => key.slice(OWNER.length + 1)).sort();
  const resolvedCyse = new Set((review?.closure_review_rows || []).filter((row) => (
    row.owner_namespace === OWNER && CACHE_REACQUIRE_CODES.includes(row.code)
      && row.status === 'none' && row.review_status === 'promoted_structural_none'
  )).map((row) => row.code));
  const expectedOutside = [...BLOCKED_CODES,
    ...CACHE_REACQUIRE_CODES.filter((code) => !resolvedCyse.has(code))].sort();
  if (!same(actualOutside, expectedOutside)) issues.push('outside_code_inventory');
  for (const [code, expected] of Object.entries(FORMULA_ROWS)) {
    const [scope, groupHash, rawHash, groupCount, pathCount, conditionCount,
      outsideCounts] = expected;
    const row = (scope === 'direct' ? direct : closure).get(code);
    if (!row || row.status !== 'parsed') {
      issues.push(`${code}:parsed_row`);
      continue;
    }
    if (sha256(JSON.stringify(row.groups)) !== groupHash
        || sha256(row.raw_requisites || '') !== rawHash
        || row.groups.length !== groupCount) issues.push(`${code}:formula_hash`);
    let paths = 0;
    let conditions = 0;
    const counts = {};
    for (const group of row.groups) {
      paths += (group.paths || []).length;
      for (const path of group.paths || []) {
        for (const condition of path.all_of || []) {
          conditions += 1;
          if (OUTSIDE_CODES.includes(condition.code)) {
            counts[condition.code] = (counts[condition.code] || 0) + 1;
          }
        }
      }
    }
    if (paths !== pathCount || conditions !== conditionCount
        || !same(counts, outsideCounts)) issues.push(`${code}:formula_shape`);
  }
  return issues;
}

module.exports = {
  BLOCKED_CODES,
  BLOCKER_PAGES,
  BOUNDARY,
  CACHE_REACQUIRE_CODES,
  CACHE_REACQUISITION_RECEIPT,
  CATALOG_YEAR,
  CLOSURE_CODES,
  CONTRACT,
  CYSE_PAGE,
  CYSE_ROWS,
  FORMULA_ROWS,
  OUTSIDE_CODES,
  OWNER,
  PAGES,
  RECEIPT,
  REVIEW_REASON,
  ROWS,
  SCHOOL_ID,
  SLUG,
  blockedOutsideReferenceAudit,
  blockerForCode,
  cachedCyseResolution,
  cachedCyseReacquisitionReceipt,
  cachedCyseReviewResolution,
  cachedCyseResolutionRowIssues,
  closureResolution,
  closureResolutionRowIssues,
  closureReviewRowIssues,
  expectedCompleteEntryReceipt,
  nonrequiredSignals,
  outsideFormulaIssues,
  pageFileIssues,
  pageReceipt,
  rowReceipt,
  sha256,
};
