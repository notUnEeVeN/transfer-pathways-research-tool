/**
 * Pair-level Figure 3/4 proof for Radford's B.S.-specific science rule.
 *
 * This module never treats a broad science label or a four-credit course as
 * laboratory evidence. A usable pair is the conjunction of (1) one exact
 * accepted/final-projection A.S. tree, (2) retained official VCCS contact
 * hours, (3) the exact incoming Transfer Virginia edge, and (4) the exact
 * current Radford receiving course/credits/laboratory receipt.
 *
 * Publication use requires a separately retained Transfer Virginia
 * equivalency receipt for the exact sending institution and both courses in
 * the pair.  A statewide common-course identity or an `offered_by` roster is
 * useful discovery evidence, but it is not a college-specific articulation
 * receipt and therefore cannot make a paper cell ready.
 */

const { createHash } = require('node:crypto');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const { exactRadfordTree } = require('./radfordConstraintProofs');
const { parseCourseCode } = require('../vaCourseCodes');
const {
  canonicalCourseCode,
  courseIdFor,
  institutionCourseIdentity,
  parentIdForLanding,
} = require('../virginia/courseIdentity');
const evidence = require('../../.va-catalogs/research/radford-science-pair-evidence.json');
const collegeEquivalencyEvidence = require(
  '../../.va-catalogs/research/radford-college-science-pair-equivalency-evidence.json'
);
const remainingSciencePairEvidence = require(
  '../../.va-catalogs/research/radford-remaining-science-pair-evidence.json'
);
const {
  EQUIVALENCY_RECEIVING_NAMES,
  EQUIVALENCY_RECEIVING_NOTES,
  EQUIVALENCY_SOURCE_URLS,
  SCIENCE_FACTS,
  radfordSciencePairEvidenceIssue,
} = require('./radfordSciencePairEvidence');
const {
  exactPositiveReceipt,
  radfordCollegeSciencePairEvidenceIssue,
} = require('./radfordCollegeSciencePairEvidence');
const {
  radfordRemainingSciencePairEvidenceIssue,
} = require('./radfordRemainingSciencePairEvidence');

const RADFORD_SCIENCE_RULE = 'two_sciences_one_laboratory';
const RADFORD_SCIENCE_GROUP_PATH = 'requirement_groups[2]';
const RADFORD_SCIENCE_GROUP_INDEX = 2;
const RADFORD_FREE_ELECTIVE_GROUP_INDEX = 12;
const RADFORD_FREE_ELECTIVE_UNITS = 35;
const RADFORD_PAIR_RECEIVING_UNITS = 8;
const RADFORD_PAIR_SENDING_UNITS = 8;
const RADFORD_PAIR_CAPACITY_DISPLACEMENT = 2;
const RADFORD_REMAINING_FREE_ELECTIVE_UNITS = 33;
const RICHARD_BLAND_SLUG = 'richard-bland-college';
const RICHARD_BLAND_OWNER = `va:cc:${RICHARD_BLAND_SLUG}`;
const RICHARD_BLAND_PAIR = Object.freeze(['PHYS201', 'PHYS202']);

const rows = [
  ['blue-ridge-community-college', 9301, 'Blue Ridge Community College', '2b25b54fbb7b9d029cde78b3544cac6706c001114f9596aae532d152b92bdf99', ['CHM111', 'CHM112']],
  ['brightpoint-community-college', 9302, 'Brightpoint Community College', 'c5be273cc14922c43e6d0e4478137c8f445a7006947df36688d011f53d052ea1', ['CHM111', 'CHM112']],
  ['central-virginia-community-college', 9303, 'Central Virginia Community College', '13ce276ee6c3642a2db16e0214c87bd8f6a12239efbe5c94d3f48f5263d5d884', ['CHM111', 'CHM112']],
  ['germanna-community-college', 9306, 'Germanna Community College', 'b297d462c7264a391a5e78acd87015c0fcf1ac35fedcefb70d4961304278d5ba', ['CHM111', 'CHM112']],
  ['j-sargeant-reynolds-community-college', 9307, 'J Sargeant Reynolds Community College', '5d520c60b011fbec1b29ca9163018d916c535cd7f55a23662fc81e1c0d666278', ['CHM111', 'CHM112']],
  ['laurel-ridge-community-college', 9308, 'Laurel Ridge Community College', '7e2f93069b9cc8b725540d1b7cd1c9e68bfcdd902b47861bebd92228c154e4c0', ['CHM111', 'CHM112']],
  ['mountain-gateway-community-college', 9310, 'Mountain Gateway Community College', '2c688475f1da92bf51c46b0b5cf7574251a82e426635aee3637491a366b42be0', ['CHM111', 'CHM112']],
  ['new-river-community-college', 9311, 'New River Community College', '2eb566b844869dd6e1dd2eca09a181f3fc29eb4a3780c93adb2a2af4d36ac20d', ['CHM111', 'CHM112']],
  ['northern-virginia-community-college', 9312, 'Northern Virginia Community College', 'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f', ['CHM111', 'CHM112']],
  ['paul-d-camp-community-college', 9314, 'Paul D. Camp Community College', 'dada36fc64828ffc5a2063947e53630000842e0e616a7755bad80787bb2a03ea', ['CHM111', 'CHM112']],
  ['piedmont-virginia-community-college', 9315, 'Piedmont Virginia Community College', '325429f8c94132adc593b0c6a2a5c037b22f5d3cb75983f2789d37a56f525db7', ['CHM111', 'CHM112']],
  ['rappahannock-community-college', 9316, 'Rappahannock Community College', 'c804c0c017e4c78c22cb76e757c3b5ca8f4ae99bddb12f83cb6ba402ddd49555', ['CHM111', 'CHM112']],
  ['richard-bland-college', 9317, 'Richard Bland College', 'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186', RICHARD_BLAND_PAIR],
  ['southwest-virginia-community-college', 9319, 'Southwest Virginia Community College', '0dfe87d22adef2dcc0588b3c13e7fab92748c027add477fd087f91f93a981d1c', null, 'the exact A.S. tree exposes only one named eligible science course'],
  ['tidewater-community-college', 9320, 'Tidewater Community College', '9baba94d24a5fd9bcac8880741722005ddb5da00dca3a31d69e9bf0c26829140', ['CHM111', 'CHM112']],
  ['virginia-highlands-community-college', 9321, 'Virginia Highlands Community College', 'c9419c1a650739480d98f045548565cdd069abae0983531c4e5fda9c722778b0', ['CHM111', 'CHM112']],
  ['virginia-peninsula-community-college', 9322, 'Virginia Peninsula Community College', '54add759b298332791fe65fcac7d2e6750ac560c4cef016b3486ca78e0dbecd1', ['CHM111', 'CHM112']],
  ['virginia-western-community-college', 9323, 'Virginia Western Community College', 'ad5f2ba8cff0958f6aeb2dc9267ec21a010fd54b34692c632519894e590197cd', ['CHM111', 'CHM112']],
  ['wytheville-community-college', 9324, 'Wytheville Community College', 'f0e904d0aeb67c27a6679585cf566af1ebd6ccd46c2af8568685e64f04b2d60e', ['PHY201', 'PHY202']],
];

// Filled from the normalized accepted-source trees only after the final
// numeric projection produced the same fingerprint. They intentionally bind
// every authored requirement, source ref, option identity, constraint, flag,
// and unit declaration rather than just a college label.
const ASSOCIATE_TREE_SHA256 = Object.freeze({
  'blue-ridge-community-college': '4fb1584bbc6f3d6704194c8e25b830eb0445a0727054e94860706a99638b4869',
  'brightpoint-community-college': '63b4885efa16a32d27689f6238442e8d5461515bd8a3150efaae877ae4d3a021',
  'central-virginia-community-college': '3682c302beb994fa16939f57eca29d0e344409a968c4bbbc4e1cea78666ff0b7',
  'germanna-community-college': 'ab73f695ad8338689a8bfdba0a46b605c1be3ca25975ce23f51564b14a81abfa',
  'j-sargeant-reynolds-community-college': '4f37858eb888fda202a7748d2895cfe9ec4df430c64449695eebad2d36e83d3b',
  'laurel-ridge-community-college': 'd9b5e09fe7a295127664d532a3336ee4b58934f7054a985c2382d5c45aeb860d',
  'mountain-gateway-community-college': '5b574d745b99a51f27a22cdcd5e8abc9d0e7e353d39e0a34b341b7e0e493f638',
  'new-river-community-college': 'ba5664936ea88219991ca7fdcd5d6116df645995b4aa2845cf45068f49afcb0a',
  'northern-virginia-community-college': 'f5de0c8901ec3a5d4bdaaa84170967f0ec3a1d288ab118f46edc85d04d5a5176',
  'paul-d-camp-community-college': 'e3b6846e51f51f303267aeceb4176b46f7a234472d07dd2ba4fc12767556bdc2',
  'piedmont-virginia-community-college': 'd979fa862519e9d207d03bf3d89338c7fde49e77a0a5f998e53ea69ec6813d4f',
  'rappahannock-community-college': '7da86d8cca4c6cad1277502f91b86158281431709cfc4b78c780ff2926d166d6',
  'richard-bland-college': '5ac8e6fd02e7a71b762d66ec955e6805c48f68c4e0c50415c12182487ffa6777',
  'southwest-virginia-community-college': '1c6b4f0bf42d20ff763386551a3bac18cf015bbb22d3760a6379cd2a9b7dfcda',
  'tidewater-community-college': 'c058d8425931e671f5bff53c525aa8e74f2648050a09b654040e7baf35be3e7f',
  'virginia-highlands-community-college': '4db2cb503cd1070f66bb5653895f4b01af838febe44fd616c06eef7e037a26c3',
  'virginia-peninsula-community-college': '04e1f61ba887c96b27fcb1a08b7f8667a95b38b4fa44e389f93ee096aa005854',
  'virginia-western-community-college': 'eb2ba0d6c6442f52e3d0cea8d02f0d6e701be1db63e7650aa28c87f5d42bd352',
  'wytheville-community-college': '4ede77ca7dec748b9f9d42a9cbe161c647088332f1fca66c7a4b4dddbb71214a',
});

const ASSOCIATE_MATRIX = Object.freeze(Object.fromEntries(rows.map(([
  slug, numericId, name, sourceBundleHash, pair, blocker,
]) => [slug, Object.freeze({
  slug, numeric_id: numericId, name, source_bundle_sha256: sourceBundleHash,
  pair: pair ? Object.freeze([...pair]) : null,
  blocker: blocker || null,
})])));

// Candidate compositions and the authoritative stored cohort are separate,
// exact evidence variants. A source-bundle match alone is never sufficient:
// every variant binds the source identity and accepted-source/final-projection
// tree independently. Authoritative stored variants additionally bind the
// exact verification receipt. Candidate compositions confer no verification;
// the publication gate remains the sole authority for that status. The
// candidate map is retained for all 19 colleges.  Stored variants include the
// eleven measured positive-pair trees plus two exact negative trees.  The
// negative Richard Bland/Southwest bindings do not create a pair or authorize
// publication; they merely ensure the runtime reports the substantive,
// source-bound absence instead of masking it behind wrapper/source-bundle
// drift.
const CANDIDATE_SOURCE_IDENTITY_SHA256 = Object.freeze({
  'blue-ridge-community-college': '8e82a586d9aa11376326710d27482f92b0de7035bd28c7da9a5ac036649420ce',
  'brightpoint-community-college': '1f9015190e56bd05ccf7ad5aaf16188721646390b7ee72aa54afae881f90fdb5',
  'central-virginia-community-college': 'a37296d86cf7b1d30fb288420e3215060116d9e8c8e8f9ceb2a2a68063e13a66',
  'germanna-community-college': '6b091bb42b3bb0e931d0d07ef61bb664b43a9f2f69e2d7d5872caf03887ede4e',
  'j-sargeant-reynolds-community-college': 'd81d0fa7b8a3f440f317d72438ef8a76abc82b9c4dbd7380c2c4416641d370b9',
  'laurel-ridge-community-college': 'ed19f2f32f19e740232c4298783d4eb0a230e12f085daf5216425ec34c0b967a',
  'mountain-gateway-community-college': '126da34a19a7fa9820d49b01df57cab325051c641aff21c2cb333c96c84d4dcb',
  'new-river-community-college': '81b82fb7ad3229b8fa3aebb5598b5757c1936e5e457e2d8a7b279c31c63fe69e',
  'northern-virginia-community-college': '4c1aa06f68f395569fbfbc54b9aff8890dc1624c6933f78066b502cb00c13563',
  'paul-d-camp-community-college': 'adbec120e6feda7d42134e7869b598bd8929126b9a3d2b370b2738418fa0da45',
  'piedmont-virginia-community-college': 'ba46d94b8db81fd8a65dd138318a32d69fbf3c4c796a682aee6a3307376d416b',
  'rappahannock-community-college': '96e9b40ca5ba6788648a6d86d376a55d621bdcb612614c08cf58813911d6ba74',
  'richard-bland-college': '88b7bf7924fb7d452c0316d8c5fc9f39fae43f27ac81b8e59da9a6944acf989a',
  'southwest-virginia-community-college': 'bf25ff51f1c9c26c46d9a1f246f660a741e2efaa395b96e5c2c1687ab867e5bf',
  'tidewater-community-college': '0b8f678733ec94dcdf598cdeb5849b694be86eaa0364896d50fd825ec79066f3',
  'virginia-highlands-community-college': '8879e320907f03885357da83172105a97d38afa84bc382aa41404534687f92c8',
  'virginia-peninsula-community-college': 'bea4fd7902b48a243aeb41f7d69022a2755a8d35370cc586dc076c33db3b1a9f',
  'virginia-western-community-college': 'd4677d31250ac4b87eaebec000c35d33accf3d33017a385bd5f359d30236fa27',
  'wytheville-community-college': 'b450463e54edd102e19303042198a36428ccb1d73f4f1542d10677c80c5bc62b',
});

const AUTHORITATIVE_STORED_VARIANTS = Object.freeze({
  'blue-ridge-community-college': Object.freeze({
    source_bundle_sha256: 'abbc11169ae8def70573bfaae2d0e707c7ef445079214a5c38d75ed12663bb45',
    source_identity_sha256: 'bfaad23ae8704640b68f2ca36b03f4c4a8ec7f05da88faf65e4d5a11706305f1',
    verification_sha256: 'ba69aaf9d5482d2190ce21981ec805c5115d0575754eb2096cf75a38bc097ff0',
    verification_verified: true,
    accepted_source_tree_sha256: '63a47b9261c9c904b5955af8f58bfe1ed075b303edca3ef11d6c66587cc66693',
    final_projection_tree_sha256: '6b99243a18f36a1ecb6871bb912b6613d45aec0e985f15c06c2b7aae22f6690d',
  }),
  'central-virginia-community-college': Object.freeze({
    source_bundle_sha256: '0423d6052f467ff537d048732ddef701a7ea6efb9f9c832271259a6ab36b41f6',
    source_identity_sha256: '97c709d92c5ce74e56e362722566c72f352b1518eb3b81b47e83522bb2763d17',
    verification_sha256: 'ee79b6a9216c7bcd7caefbc5f709acf0ba3b18ab350c363952520c1b92174a39',
    verification_verified: true,
    accepted_source_tree_sha256: 'a61754b92e1c08ec20a397acf2dd9c667a799e51cc905e8f62386c96c915f4c6',
    final_projection_tree_sha256: 'a61754b92e1c08ec20a397acf2dd9c667a799e51cc905e8f62386c96c915f4c6',
  }),
  'germanna-community-college': Object.freeze({
    source_bundle_sha256: '8bd3d46c00fb0a4261c13a4b5364eefb3d8ed5e2b3117bc4fcd4e707cbf21980',
    source_identity_sha256: '031c718047df3c8261f58d01ec016aedb37111c43c9e672c30e1876616497d3c',
    verification_sha256: '2f32526b68b01669feb870df78ab3d85fb3a12102e793f6ca40b0579d9ec525e',
    verification_verified: true,
    accepted_source_tree_sha256: '48420cf38a601ac5f5e610e3f3903872883c541393ce814b6446f22843a6189a',
    final_projection_tree_sha256: '48420cf38a601ac5f5e610e3f3903872883c541393ce814b6446f22843a6189a',
  }),
  'j-sargeant-reynolds-community-college': Object.freeze({
    source_bundle_sha256: '8db587598e37b7e05ee45be734b461f8528dceb39909c4049aad2bc84a06b65b',
    source_identity_sha256: 'cf68c781aef08231fde3b3b26d880ea16e28e814818f8737622d5fc0ef43b0b1',
    verification_sha256: 'e109f14fe94983ed9a388c28e718787942e276ece2ee2692c1d4e11b1978235b',
    verification_verified: false,
    accepted_source_tree_sha256: 'd0deb5aedf5ded2e294c3933693885dfff8897d73c921280f1bc606d0b545910',
    final_projection_tree_sha256: 'd0deb5aedf5ded2e294c3933693885dfff8897d73c921280f1bc606d0b545910',
  }),
  'mountain-gateway-community-college': Object.freeze({
    source_bundle_sha256: 'd9d62f38fd9f39cb89d3da1fa5c9ffbfe06bb698b400ef0030eb99a56ed83a79',
    source_identity_sha256: 'd2917190b8db2b4e78594b8a6e3ce29e8636fc62323d409eee810b55ed39b2b8',
    verification_sha256: 'd13541b17908721322a5a543a18b5bbb22c19bc0910a9287cac8e0e6f35d4fba',
    verification_verified: true,
    accepted_source_tree_sha256: '62544af90e555764dbd23c3926fb00e082d9f6d74496428fc29850f4a0201b75',
    final_projection_tree_sha256: 'fb6cdc37b098cd22ebbbc79674888e1fe8c6d8f99b5b1b55e71b278c99fac851',
  }),
  'new-river-community-college': Object.freeze({
    source_bundle_sha256: '2eb566b844869dd6e1dd2eca09a181f3fc29eb4a3780c93adb2a2af4d36ac20d',
    source_identity_sha256: '81b82fb7ad3229b8fa3aebb5598b5757c1936e5e457e2d8a7b279c31c63fe69e',
    verification_sha256: 'e858daed46a40bd2245f66316164c0bb18720e009779b4f45fbf80cf6d26f15f',
    verification_verified: true,
    accepted_source_tree_sha256: '3069448bc0f72b71f6ad466a76db98ebdf370c82fef2dd896f41cf8d05e93270',
    final_projection_tree_sha256: '9d292dc43ffd729d30ad73e11b83d5d0d3caf9dcd39e0de11e267f9cf7f82bb4',
  }),
  'northern-virginia-community-college': Object.freeze({
    source_bundle_sha256: 'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f',
    source_identity_sha256: '4c1aa06f68f395569fbfbc54b9aff8890dc1624c6933f78066b502cb00c13563',
    verification_sha256: '5ecbddd5ee2c7eb218bcc3f83a9e7fc0d69f2bc318f4427ac9ae75126fb1ba38',
    verification_verified: true,
    accepted_source_tree_sha256: 'a485d85f0692345a0a711548e79f041ef5df22ca2ce688e43b3865c885360af4',
    final_projection_tree_sha256: 'a485d85f0692345a0a711548e79f041ef5df22ca2ce688e43b3865c885360af4',
  }),
  'paul-d-camp-community-college': Object.freeze({
    source_bundle_sha256: '0c5760c092672fd03a7f25952ef33da999d89b1e841d2650326d51df9f85d071',
    source_identity_sha256: 'a0db8cacfafa75612c74be115f25c62ca2c584546d6901b9914f3540ea6a1f5d',
    verification_sha256: 'e109f14fe94983ed9a388c28e718787942e276ece2ee2692c1d4e11b1978235b',
    verification_verified: false,
    accepted_source_tree_sha256: '52757ed332576e63bb62b5f7679d752df0bd2ff9ab29ae2325e09dd30b6dbeeb',
    final_projection_tree_sha256: '52757ed332576e63bb62b5f7679d752df0bd2ff9ab29ae2325e09dd30b6dbeeb',
  }),
  'rappahannock-community-college': Object.freeze({
    source_bundle_sha256: '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25',
    source_identity_sha256: 'da441bed2f8ec84664fcb77dacf7a9a4905c38117705359359b56420906c3736',
    verification_sha256: '7d8210b9de6bf01b9972e990366e29d2e7a31fca29900c3ba5053b521c1d15a8',
    verification_verified: true,
    accepted_source_tree_sha256: '289c3b4c86141a437811b9e8263ffdce04fd830b8a3a6bde916152b6a64a2adc',
    final_projection_tree_sha256: '289c3b4c86141a437811b9e8263ffdce04fd830b8a3a6bde916152b6a64a2adc',
  }),
  'richard-bland-college': Object.freeze({
    source_bundle_sha256: '9511b3b5844ffdac140358812ee5c0a5074960b4544a53d12c5af3772ade1c79',
    source_identity_sha256: 'a780508a8d72c1db892205b9a3eecd797fb2ff9ff96c8222800f01be699269d4',
    verification_sha256: '3310f07c20cb8f9e0a67aed6d317020cf72f9ddda3434bb7be78f990f64f31a7',
    verification_verified: true,
    accepted_source_tree_sha256: 'f9173cb24185df74dd42f4600f7e8ca0b218efd801078e2dd1e9db5d92ba0a99',
    final_projection_tree_sha256: '619be5e00591af27caf7c2ca67cef0e593d29215bd782a61ea8636157d075dcc',
  }),
  'southwest-virginia-community-college': Object.freeze({
    source_bundle_sha256: 'ef50004db5ad78feb6d768aa5a29e548039b77fdbbd9f4df2a13beb9c3fb8ada',
    source_identity_sha256: 'bad9fee6be25f8ac8be91e74bcf7fef2aec9b0515da894baf57fb274d3985933',
    verification_sha256: 'dc1675f97c313f2def50293fc1305a33112f3ac6520fea1c65df8059fd00f635',
    verification_verified: true,
    accepted_source_tree_sha256: '1c6b4f0bf42d20ff763386551a3bac18cf015bbb22d3760a6379cd2a9b7dfcda',
    final_projection_tree_sha256: '1c6b4f0bf42d20ff763386551a3bac18cf015bbb22d3760a6379cd2a9b7dfcda',
  }),
  'tidewater-community-college': Object.freeze({
    source_bundle_sha256: '93932f97995a37ae41f0691b2e2fac838df4e826d2cb1179d94ebbc1bce2282f',
    source_identity_sha256: 'c0e73281d472668aeeba7f63063d5fc7de4ef399fbdc5b8273a3213e6ca8cd07',
    verification_sha256: '6585d18460532311374cd8ed8e2bef7851612894ea5cbbf586e4b9a9f549e8db',
    verification_verified: true,
    accepted_source_tree_sha256: 'bbd1c36bc8c82424558a51baeaa4b812add50d0d43ba319903d29e87e1288fe1',
    final_projection_tree_sha256: 'bbd1c36bc8c82424558a51baeaa4b812add50d0d43ba319903d29e87e1288fe1',
  }),
  'virginia-peninsula-community-college': Object.freeze({
    source_bundle_sha256: '24c152befa8d63552fa3df4a364c844c8afcd2e190bfbb79271250800484fc87',
    source_identity_sha256: '682745a8367ee5659ffb518a7918f2594c02f6b42fbddc6c3442cc5eed538745',
    verification_sha256: '46e3a59b3cf2a3135bd65552a4229795d345176c53ca4805ab1cea2d83d53239',
    verification_verified: true,
    accepted_source_tree_sha256: 'b20edfee9908c57c4dc7792653acaade9e12c820b9c9b005a7d6cd1f15b59c9d',
    final_projection_tree_sha256: 'b20edfee9908c57c4dc7792653acaade9e12c820b9c9b005a7d6cd1f15b59c9d',
  }),
});

function freezeVariant(variant, values) {
  return Object.freeze({
    variant,
    source_bundle_sha256: values.source_bundle_sha256,
    source_identity_sha256: values.source_identity_sha256,
    verification_sha256: values.verification_sha256,
    verification_verified: values.verification_verified ?? null,
    condition_scope: 'radford_figure_3_4_condition_only',
    publication_readiness_authorized: false,
    tree_sha256: Object.freeze({
      accepted_source: values.accepted_source_tree_sha256,
      final_projection: values.final_projection_tree_sha256,
    }),
  });
}

const ASSOCIATE_VARIANT_BINDINGS = Object.freeze(Object.fromEntries(rows.map(([
  slug, , , sourceBundleHash,
]) => {
  const candidate = freezeVariant('candidate', {
    source_bundle_sha256: sourceBundleHash,
    source_identity_sha256: CANDIDATE_SOURCE_IDENTITY_SHA256[slug],
    // Candidate composition bindings predate and do not confer human
    // verification. Publication verification is deliberately outside this
    // Figure 3/4 condition resolver.
    verification_sha256: null,
    verification_verified: null,
    accepted_source_tree_sha256: ASSOCIATE_TREE_SHA256[slug],
    final_projection_tree_sha256: ASSOCIATE_TREE_SHA256[slug],
  });
  const stored = AUTHORITATIVE_STORED_VARIANTS[slug];
  return [slug, Object.freeze(stored
    ? [candidate, freezeVariant('authoritative_stored', stored)]
    : [candidate])];
})));

const MOUNTAIN_STORED_CARRIER_SHA256 = Object.freeze({
  accepted_source: '8f37021090eaef3320d3ca9763c6c9bb09499709264f26d07394c13105473de6',
  final_projection: '9d66ffe897b9c678d22cc3e4d085425a35fb8b032048ccea2b86a72283740f87',
});

/**
 * Three accepted sources publish the Radford pair through reviewed aggregate
 * capacity rather than two ordinary named receivers. These receipts do not
 * rewrite the degree tree. They authorize one exact Radford-only selection
 * from the already-authored category credit, after which the strict planner
 * must still close the complete degree and select both course identities.
 *
 * `source_sha256` values are the exact retained official bytes represented by
 * the corresponding entries in `document.sources`; artifact tests replay the
 * retained text and assert the cited clauses/course rows remain present.
 */
const SOURCE_BOUND_CARRIER_EVIDENCE = Object.freeze({
  'j-sargeant-reynolds-community-college': Object.freeze({
    rule: 'reynolds_radford_destination_elective_science_pair',
    pair: Object.freeze(['CHM111', 'CHM112']),
    aggregate_units_replaced: 4,
    sources: Object.freeze([
      Object.freeze({
        id: 'major',
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4173',
        sha256: '260a0254b8b4e1f7ff1f192d7de012261d7380a3d8e69034b1572f27dbf8e428',
        retained_text: 'j-sargeant-reynolds-community-college__program3.txt',
        required_fragments: Object.freeze([
          'CHM 111\u00a0-\u00a0General Chemistry I Credit Hours: 4 or',
          'Approved Elective based on 4-year institution Credit Hours: 4',
          'Total Required Program Credit Hours: 63',
        ]),
      }),
      Object.freeze({
        id: 'general_education',
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=3925',
        sha256: '1a043a2af888973343ddf2ac10ab1fb22b6357167388891514021ba097743d73',
        retained_text: 'j-sargeant-reynolds-community-college__ge.txt',
        required_fragments: Object.freeze([
          'CHM 111\u00a0-\u00a0General Chemistry I Credit Hours: 4',
          'CHM 112\u00a0-\u00a0General Chemistry II Credit Hours: 4',
        ]),
      }),
    ]),
  }),
  'mountain-gateway-community-college': Object.freeze({
    rule: 'mountain_gateway_radford_science_specialized_pair',
    pair: Object.freeze(['CHM111', 'CHM112']),
    aggregate_units_replaced: 8,
    sources: Object.freeze([
      Object.freeze({
        id: 'science_specialized',
        url: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=975&returnto=478',
        sha256: 'dc40c89a36f35758f31c4355b6d6ace8c58822bf0bf6c09fe55d5e0245a39521',
        retained_text: 'mountain-gateway-community-college__science_specialized.txt',
        required_fragments: Object.freeze([
          'Science Specialized Requirements',
          'CHM 111\u00a0-\u00a0College Chemistry I Credits: 4',
          'CHM 112\u00a0-\u00a0College Chemistry II Credits: 4',
        ]),
      }),
    ]),
  }),
  'paul-d-camp-community-college': Object.freeze({
    rule: 'camp_radford_two_published_science_slots',
    pair: Object.freeze(['CHM111', 'CHM112']),
    aggregate_units_replaced: 8,
    sources: Object.freeze([
      Object.freeze({
        id: 'major',
        url: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
        sha256: 'ead1e63dc89775cb89571e68497e865ce1a5f190d2ed367a010856331a942089',
        retained_text: 'paul-d-camp-community-college__program.txt',
        required_fragments: Object.freeze([
          'Science                Any UCGS Approved Natural Science',
          'Science                Any TransferVA Approved Science',
          'Total Program Credits 61',
        ]),
      }),
      Object.freeze({
        id: 'general_education',
        url: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
        sha256: 'ead1e63dc89775cb89571e68497e865ce1a5f190d2ed367a010856331a942089',
        retained_text: 'paul-d-camp-community-college__ge.txt',
        required_fragments: Object.freeze([
          'CHM      111    College Chemistry I',
          'CHM      112    College Chemistry II',
        ]),
      }),
    ]),
  }),
});

const factsBySendingCode = new Map(SCIENCE_FACTS.map((fact) => [
  fact.sending_code,
  Object.freeze({
    ...fact,
    sending_course_key: `va:${fact.sending_code}`,
    receiving_name: EQUIVALENCY_RECEIVING_NAMES[fact.sending_code],
    receiving_notes: EQUIVALENCY_RECEIVING_NOTES[fact.sending_code],
    sending_source_url: EQUIVALENCY_SOURCE_URLS[fact.sending_code],
  }),
]));
const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => value == null ? null : String(value).trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function evidenceStable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(evidenceStable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key, evidenceStable(value[key]),
  ]));
}

function evidenceHash(value) {
  return createHash('sha256').update(JSON.stringify(evidenceStable(value))).digest('hex');
}

function associateSourceIdentityFingerprint(document) {
  return hash({
    catalog_platform: document?.catalog_platform ?? null,
    catalog_url: document?.catalog_url ?? null,
    source: document?.source ?? null,
    source_method: document?.source_method ?? null,
    provenance: document?.provenance ?? null,
    sources: document?.sources ?? [],
  });
}

function associateVerificationFingerprint(document) {
  return evidenceHash(document?.verification ?? null);
}

function exactAssociateVariantFingerprintBinding(slug, candidate = {}) {
  if (candidate?.usage !== 'radford_figure_3_4_condition') {
    return {
      supported: false,
      reason: 'the exact Radford associate variant cannot authorize publication readiness or another use',
    };
  }
  const variants = ASSOCIATE_VARIANT_BINDINGS[slug] || [];
  const style = candidate?.document_style;
  if (!['accepted_source', 'final_projection'].includes(style)) {
    return { supported: false, reason: 'the associate document style changed' };
  }
  let matches = variants.filter((variant) => (
    variant.source_bundle_sha256 === candidate?.source_bundle_sha256
  ));
  if (!matches.length) {
    return { supported: false, reason: 'the associate retained source-bundle receipt changed' };
  }
  matches = matches.filter((variant) => (
    variant.source_identity_sha256 === candidate?.source_identity_sha256
  ));
  if (!matches.length) {
    return { supported: false, reason: 'the exact associate source identity changed' };
  }
  matches = matches.filter((variant) => (
    variant.tree_sha256[style] === candidate?.associate_tree_sha256
  ));
  if (!matches.length) {
    return {
      supported: false,
      reason: 'the exact associate Boolean tree, units, source refs, course identities, constraints, or flags changed',
    };
  }
  matches = matches.filter((variant) => (
    variant.variant === 'candidate'
      || (variant.verification_sha256 === candidate?.verification_sha256
        && variant.verification_verified === candidate?.verification_verified)
  ));
  if (matches.length !== 1) {
    return { supported: false, reason: 'the exact associate verification boundary changed' };
  }
  return {
    supported: true,
    binding: matches[0],
  };
}

function normalizedConstraint(constraint) {
  return {
    kind: text(constraint?.kind), status: text(constraint?.status),
    description: text(constraint?.description),
  };
}

function normalizedOption(option) {
  const sourceKeys = array(option?.source_course_keys).length
    ? option.source_course_keys : option?.course_keys;
  return {
    ids: array(option?.course_ids).map(Number),
    source_keys: array(sourceKeys).map(text),
    conjunction: text(option?.course_conjunction)?.toLowerCase(),
  };
}

function normalizedReceiving(receiving) {
  if (!receiving || typeof receiving !== 'object') return null;
  return {
    kind: text(receiving.kind)?.toLowerCase(),
    parent_id: number(receiving.parent_id),
    parent_ids: array(receiving.parent_ids).map(Number),
    code: text(receiving.code),
    codes: array(receiving.codes).map(text),
    name: text(receiving.name),
    units: number(receiving.units),
    conjunction: text(receiving.conjunction)?.toLowerCase(),
  };
}

function normalizedReceiver(receiver) {
  return {
    articulation_status: text(receiver?.articulation_status),
    not_articulated_reason: text(receiver?.not_articulated_reason),
    options_conjunction: text(receiver?.options_conjunction)?.toLowerCase(),
    tier: text(receiver?.tier), level: text(receiver?.course_level),
    cc: receiver?.cc_articulable ?? null,
    overlap: text(receiver?.overlap_key), note: text(receiver?.note),
    receiving: normalizedReceiving(receiver?.receiving),
    code_seen: text(receiver?.code_seen),
    options: array(receiver?.options).map(normalizedOption),
  };
}

function normalizedSection(section) {
  return {
    ask: number(section?.section_advisement),
    units: number(section?.unit_advisement),
    max: number(section?.unit_advisement_max),
    label: text(section?.label_seen), tier: text(section?.tier),
    level: text(section?.course_level), cc: section?.cc_articulable ?? null,
    refs: [...array(section?.source_refs)], note: text(section?.note),
    overlap: text(section?.overlap_key), human_review: section?.human_review ?? null,
    assume: section?.assume_satisfiable === true,
    constraints: array(section?.analysis_constraints).map(normalizedConstraint),
    receivers: array(section?.receivers).map(normalizedReceiver),
  };
}

function normalizedGroup(group) {
  return {
    title: text(group?.title), required: group?.is_required !== false,
    conjunction: text(group?.group_conjunction)?.toLowerCase(),
    canonical: Number.isInteger(group?.canonical_section_index)
      ? group.canonical_section_index : null,
    layer: text(group?.requirement_layer), tier: text(group?.tier),
    level: text(group?.course_level), cc: group?.cc_articulable ?? null,
    refs: [...array(group?.source_refs)], stated: text(group?.stated_credits),
    note: text(group?.note), overlap: text(group?.overlap_key),
    human_review: group?.human_review ?? null,
    distinct: group?.distinct_course_ids_across_sections === true,
    units_fill: group?.units_fill === true,
    ge_area: text(group?.ge_area),
    constraints: array(group?.analysis_constraints).map(normalizedConstraint),
    sections: array(group?.sections).map(normalizedSection),
  };
}

function normalizedAssociateScienceTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    total_units: number(document?.total_units),
    total_units_max: number(document?.total_units_max),
    requirement_layers: document?.requirement_layers || null,
    unit_audit: document?.unit_audit || null,
    modeling_notes: [...array(document?.modeling_notes)],
    data_quality_flags: [...array(document?.data_quality_flags)],
    analysis_constraints: array(document?.analysis_constraints).map(normalizedConstraint),
    source_conflicts: [...array(document?.source_conflicts)],
    sources: [...array(document?.sources)],
    groups: array(document?.requirement_groups).map(normalizedGroup),
  };
}

function associateScienceTreeFingerprint(document) {
  return hash(normalizedAssociateScienceTree(document));
}

function associateStyle(document, row) {
  const sourceId = `va:as:${row.slug}:cs`;
  const source = document?._id === sourceId
    && document?.kind === 'as_degree'
    && document?.community_college_id === `va:cc:${row.slug}`
    && document?.college_id === `va:cc:${row.slug}`
    && document?.status === 'extracted'
    && text(document?.degree_type)?.toUpperCase() === 'AS';
  const projection = document?._id === `as_degree:${row.numeric_id}:va-cs:local_as`
    && document?.kind === 'as_degree'
    && Number(document?.community_college_id) === row.numeric_id
    && document?.college_id === `va:cc:${row.numeric_id}`
    && document?.college_name === row.name
    && document?.va_requirement_id === sourceId
    && document?.status === 'found'
    && document?.va_requirement_status === 'extracted'
    && text(document?.state)?.toLowerCase() === 'va'
    && text(document?.degree_type) === 'local_as'
    && text(document?.source_degree_type)?.toUpperCase() === 'AS'
    && usesCanonicalSourceContract(document);
  return [source, projection].filter(Boolean).length === 1
    ? (source ? 'accepted_source' : 'final_projection') : null;
}

function rowForAssociate(document) {
  const sourceId = text(document?.va_requirement_id ?? document?._id);
  const match = /^va:as:([a-z0-9-]+):cs$/.exec(sourceId || '');
  return match ? ASSOCIATE_MATRIX[match[1]] || null : null;
}

function exactAssociateScienceTree(document) {
  const row = rowForAssociate(document);
  if (!row) return { supported: false, reason: 'the associate source is outside the exact active 19-source Radford matrix' };
  const style = associateStyle(document, row);
  if (!style) return { supported: false, reason: 'the associate source/projection identity changed' };
  if (document?.catalog_year !== '2026-2027'
      || document?.provenance?.composition_artifact
        !== `server/.va-catalogs/composed/${row.slug}.json`) {
    return { supported: false, reason: 'the associate catalog or composition-artifact identity changed' };
  }
  const fingerprint = associateScienceTreeFingerprint(document);
  const variant = exactAssociateVariantFingerprintBinding(row.slug, {
    usage: 'radford_figure_3_4_condition',
    document_style: style,
    source_bundle_sha256: document?.provenance?.source_bundle_hash,
    source_identity_sha256: associateSourceIdentityFingerprint(document),
    verification_sha256: associateVerificationFingerprint(document),
    verification_verified: document?.verification?.verified ?? null,
    associate_tree_sha256: fingerprint,
  });
  if (!variant.supported) return variant;
  return {
    supported: true,
    row,
    proof: {
      document_style: style,
      variant: variant.binding.variant,
      associate_tree_sha256: fingerprint,
      source_bundle_sha256: variant.binding.source_bundle_sha256,
      source_identity_sha256: variant.binding.source_identity_sha256,
      verification_sha256: variant.binding.verification_sha256,
      verification_verified: variant.binding.verification_verified,
      condition_scope: variant.binding.condition_scope,
      publication_readiness_authorized:
        variant.binding.publication_readiness_authorized,
    },
  };
}

function exactArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

/**
 * Exact supplemental receipt for the one owner-local Richard Bland pair.
 * This deliberately cannot fall back to `courseIdFor(code)`: PHYS 201/202 at
 * Richard Bland are different four-credit courses from the statewide VCCS
 * rows carrying the same display codes.
 */
function exactRichardBlandPairEvidence(
  candidate = remainingSciencePairEvidence,
) {
  const issue = radfordRemainingSciencePairEvidenceIssue(candidate);
  if (issue) return { supported: false, reason: issue };
  const cells = array(candidate?.facts?.cells).filter((cell) => (
    number(cell?.numeric_id) === 9317 && cell?.slug === RICHARD_BLAND_SLUG
  ));
  if (cells.length !== 1) {
    return { supported: false, reason: 'the exact Richard Bland supplemental cell changed' };
  }
  const cell = cells[0];
  const planIdentities = array(cell?.sending_plan?.selected_sciences);
  const selectedPair = array(cell?.selected_pair);
  const receivingCourses = array(cell?.receiving_courses);
  if (cell?.safe_to_close !== true
      || cell?.verdict !== 'closed_by_exact_college_specific_evidence'
      || cell?.blocker !== null
      || number(cell?.selected_sending_units) !== RADFORD_PAIR_SENDING_UNITS
      || number(cell?.selected_receiving_units) !== RADFORD_PAIR_RECEIVING_UNITS
      || number(cell?.distinct_selected_sciences) !== 2
      || number(cell?.selected_laboratory_courses) !== 2
      || selectedPair.length !== 2 || planIdentities.length !== 2
      || receivingCourses.length !== 2) {
    return { supported: false, reason: 'the exact Richard Bland pair inventory changed' };
  }
  const pair = [];
  const receipts = [];
  for (let index = 0; index < RICHARD_BLAND_PAIR.length; index += 1) {
    const code = RICHARD_BLAND_PAIR[index];
    const identity = institutionCourseIdentity(RICHARD_BLAND_OWNER, code);
    const planIdentity = planIdentities[index];
    const transfer = selectedPair[index];
    const receiving = receivingCourses[index];
    const receivingParentId = parentIdForLanding({
      identifier: transfer?.receiving_code,
      name: transfer?.receiving_name,
    });
    if (!identity
        || planIdentity?.code !== code
        || number(planIdentity?.course_id) !== identity.course_id
        || planIdentity?.course_key !== identity.course_key
        || planIdentity?.institution_id !== RICHARD_BLAND_OWNER
        || planIdentity?.identity_scope !== 'institution_local'
        || planIdentity?.identity_contract !== 'owner_plus_course_id'
        || planIdentity?.vccs_master_applicable !== false
        || transfer?.source_institution !== 'Richard Bland College'
        || transfer?.sending_code !== code
        || number(transfer?.sending_credits) !== 4
        || transfer?.sending_course_note
          !== 'Continuous course; three hours lecture; one hour laboratory. UCGS approved course, 2021.'
        || transfer?.receiving_institution !== 'Radford University'
        || transfer?.receiving_name !== 'Physics'
        || transfer?.receiving_notes !== null
        || receiving?.course_code !== transfer?.receiving_code
        || number(receiving?.credits) !== 4
        || !text(receiving?.laboratory_exercises_required)
        || !text(receiving?.laboratory_report_required)
        || receivingParentId == null
        || transfer?.source?.requested_url !== transfer?.source?.final_url
        || number(transfer?.source?.http_status) !== 200
        || !/^https:\/\/www\.transfervirginia\.org\/course\/[A-F0-9]+$/i
          .test(text(transfer?.source?.final_url) || '')) {
      return { supported: false, reason: 'the exact Richard Bland owner, course, laboratory, or Radford edge changed' };
    }
    pair.push(Object.freeze({
      sending_code: code,
      sending_course_id: identity.course_id,
      sending_course_key: identity.course_key,
      sending_credits: 4,
      sending_lab_hours: 1,
      receiving_code: transfer.receiving_code,
      receiving_course_id: receivingParentId,
      receiving_parent_id: receivingParentId,
      receiving_credits: 4,
      receiving_lab_hours: null,
      receiving_name: transfer.receiving_name,
      receiving_notes: transfer.receiving_notes,
      sending_source_url: transfer.source.final_url,
      articulation_institution: transfer.receiving_institution,
    }));
    receipts.push(Object.freeze({
      sending_code: code,
      receiving_code: transfer.receiving_code,
      discovery_notes: 'exact college-owned Transfer Virginia course landing',
      source_url: transfer.source.final_url,
      response_sha256: transfer.source.response_sha256,
    }));
  }
  return {
    supported: true,
    cell,
    pair: Object.freeze(pair),
    receipts: Object.freeze(receipts),
    facts_sha256: candidate.facts_sha256,
  };
}

function exactRichardBlandNamedCarrier(document, associate) {
  const supplemental = exactRichardBlandPairEvidence();
  if (!supplemental.supported) return supplemental;
  const group = document?.requirement_groups?.[7];
  const sections = array(group?.sections);
  if (document?.course_namespace?.kind !== 'institution_local'
      || document?.course_namespace?.institution_id !== RICHARD_BLAND_OWNER
      || document?.course_namespace?.vccs_master_applicable !== false
      || document?.course_namespace?.identity_contract !== 'owner_plus_course_id'
      || group?.title !== 'Investigation of the Natural World'
      || text(group?.group_conjunction)?.toLowerCase() !== 'and'
      || !exactArray(group?.source_refs, ['major'])
      || sections.length !== 2) {
    return { supported: false, reason: 'the exact Richard Bland owner-local science carrier changed' };
  }
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    const receiver = array(section?.receivers)[0];
    const option = array(receiver?.options)[0];
    const fact = supplemental.pair[index];
    const keys = array(option?.source_course_keys).length
      ? option.source_course_keys : option?.course_keys;
    if (number(section?.section_advisement) !== 1
        || number(section?.unit_advisement) !== 4
        || number(section?.unit_advisement_max) !== 4
        || !exactArray(section?.source_refs, ['major'])
        || array(section?.receivers).length !== 1
        || receiver?.articulation_status !== 'articulated'
        || text(receiver?.options_conjunction)?.toLowerCase() !== 'or'
        || receiver?.code_seen !== fact.sending_code
        || array(receiver?.options).length !== 1
        || !exactArray(option?.course_ids, [fact.sending_course_id])
        || !exactArray(keys, [fact.sending_course_key])
        || text(option?.course_conjunction)?.toLowerCase() !== 'and') {
      return { supported: false, reason: 'the exact Richard Bland selected science rows changed' };
    }
  }
  return {
    supported: true,
    rule: 'richard_bland_owner_local_named_science_pair',
    pair_codes: [...RICHARD_BLAND_PAIR],
    route_ids: supplemental.pair.map((fact) => fact.sending_course_id),
    aggregate_units_replaced: 0,
    runtime_sections: [],
    proof: {
      source_bound_aggregate_carrier: false,
      owner_namespace: RICHARD_BLAND_OWNER,
      associate_tree_sha256: associate.proof.associate_tree_sha256,
      associate_variant: associate.proof.variant,
      supplemental_facts_sha256: supplemental.facts_sha256,
      publication_readiness_authorized: false,
    },
  };
}

function exactCarrierSources(document, carrier) {
  const receipts = [];
  for (const expected of carrier.sources) {
    const matches = array(document?.sources).filter((source) => source?.id === expected.id);
    if (matches.length !== 1) return null;
    const source = matches[0];
    if (source?.url !== expected.url || source?.sha256 !== expected.sha256
        || source?.official !== true || source?.secure !== true) return null;
    receipts.push({
      id: expected.id, url: expected.url, sha256: expected.sha256,
      retained_text: expected.retained_text,
    });
  }
  return receipts;
}

function sectionOptionCodes(section) {
  return array(section?.receivers?.[0]?.options).map((option) => {
    const keys = array(option?.source_course_keys).length
      ? option.source_course_keys : option?.course_keys;
    return array(keys).map((key) => canonicalCourseCode(String(key || '').split(':').pop()));
  });
}

function exactAggregateCarrier(group, {
  title, geArea, units, unitsMax = units, sourceRefs, constraintKinds = [],
  receiverCount = 0,
} = {}) {
  const section = group?.sections?.[0];
  return group?.title === title
    && group?.ge_area === geArea
    && exactArray(group?.source_refs, sourceRefs)
    && array(group?.sections).length === 1
    && section?.section_advisement == null
    && number(section?.unit_advisement) === units
    && number(section?.unit_advisement_max) === unitsMax
    && exactArray(section?.source_refs, sourceRefs)
    && array(section?.receivers).length === receiverCount
    && exactArray(array(group?.analysis_constraints).map((entry) => entry?.kind), constraintKinds);
}

function mountainStoredCarrierFingerprint(document) {
  return hash({
    group: document?.requirement_groups?.[8] ?? null,
    option_set: document?.option_sets?.science_specialized ?? null,
  });
}

function exactMountainStoredCarrierFingerprintBinding({
  variant, document_style: documentStyle, carrier_sha256: carrierSha256,
} = {}) {
  if (variant !== 'authoritative_stored'
      || !['accepted_source', 'final_projection'].includes(documentStyle)
      || MOUNTAIN_STORED_CARRIER_SHA256[documentStyle] !== carrierSha256) {
    return {
      supported: false,
      reason: 'the exact stored Mountain Gateway receiver, menu, units, or carrier shape changed',
    };
  }
  return {
    supported: true,
    carrier_sha256: carrierSha256,
  };
}

function runtimeCarrierSection({
  codes, units, groupIndex, groupLabel, sourceRefs, sourceBoundRule,
}) {
  return {
    section_advisement: 1,
    unit_advisement: units,
    unit_advisement_max: units,
    source_refs: [...sourceRefs],
    receivers: [{
      articulation_status: 'articulated',
      options_conjunction: 'or',
      options: [{
        course_ids: codes.map(courseIdFor),
        course_keys: codes.map((code) => `va:${code}`),
        source_course_keys: codes.map((code) => `va:${code}`),
        course_conjunction: 'and',
      }],
    }],
    groupLabel,
    groupIndex,
    sectionIndex: `source_bound_radford_${sourceBoundRule}`,
    groupConjunction: 'And',
    groupStatedCredits: String(units),
    analysisConstraints: [],
    constraintKinds: [],
    sourceBoundRule,
  };
}

function sourceBoundCarrierForExactAssociate(document, associate) {
  const row = associate?.row;
  if (!row?.pair) {
    return { applicable: true, ready: false, reason: row?.blocker || 'the exact A.S. tree has no source-valid Radford science pair' };
  }
  if (row.slug === RICHARD_BLAND_SLUG) {
    const exact = exactRichardBlandNamedCarrier(document, associate);
    return exact.supported
      ? { applicable: true, ready: true, ...exact }
      : { applicable: true, ready: false, reason: exact.reason };
  }
  const carrier = SOURCE_BOUND_CARRIER_EVIDENCE[row.slug];
  if (!carrier) {
    return {
      applicable: true,
      ready: true,
      rule: 'named_associate_science_pair',
      pair_codes: [...row.pair],
      route_ids: row.pair.map(courseIdFor),
      aggregate_units_replaced: 0,
      runtime_sections: [],
      proof: { source_bound_aggregate_carrier: false },
    };
  }
  if (!exactArray(row.pair, carrier.pair)) {
    return { applicable: true, ready: false, reason: 'the source-bound Radford carrier pair declaration changed' };
  }
  const sourceReceipts = exactCarrierSources(document, carrier);
  if (!sourceReceipts) {
    return { applicable: true, ready: false, reason: 'the source-bound Radford carrier official source receipt changed' };
  }

  let carrierExact = false;
  let runtimeSections = [];
  let assignments = [];
  if (row.slug === 'j-sargeant-reynolds-community-college') {
    const named = document?.requirement_groups?.[4];
    const destination = document?.requirement_groups?.[10];
    carrierExact = named?.title === 'B.S.-destination laboratory science'
      && exactArray(named?.source_refs, ['major', 'general_education'])
      && array(named?.sections).length === 1
      && number(named.sections[0]?.unit_advisement) === 4
      && number(named.sections[0]?.unit_advisement_max) === 4
      && JSON.stringify(sectionOptionCodes(named.sections[0]))
        === JSON.stringify([['BIO101'], ['CHM111'], ['PHY241']])
      && exactAggregateCarrier(destination, {
        title: 'B.S.-destination elective capacity across four distinct printed slots',
        geArea: 'reynolds_bs_destination_elective_slots', units: 12,
        sourceRefs: ['major', 'general_education'],
      })
      && String(destination?.note || '').includes(
        'a printed four-credit receiving-institution elective'
      );
    runtimeSections = [runtimeCarrierSection({
      codes: ['CHM112'], units: 4, groupIndex: 10,
      groupLabel: 'B.S.-destination four-credit receiving-institution elective — exact Radford choice',
      sourceRefs: ['major', 'general_education'], sourceBoundRule: carrier.rule,
    })];
    assignments = [
      { code: 'CHM111', group_index: 4, role: 'printed_laboratory_science' },
      { code: 'CHM112', group_index: 10, role: 'printed_four_credit_destination_elective' },
    ];
  } else if (row.slug === 'mountain-gateway-community-college') {
    const specialized = document?.requirement_groups?.[8];
    const optionSet = document?.option_sets?.science_specialized;
    const expectedCourses = [
      'BIO101', 'BIO102', 'BIO141', 'BIO142', 'CHM111', 'CHM112',
      'MTH161', 'MTH162', 'MTH167', 'MTH245', 'MTH261', 'MTH262',
      'MTH263', 'MTH264', 'MTH265', 'PHY201', 'PHY202', 'PHY241', 'PHY242',
    ];
    const exactMenu = exactArray(optionSet?.source_refs, ['science_specialized'])
      && exactArray(optionSet?.locally_listed_courses, expectedCourses)
      && String(optionSet?.rule || '').startsWith(
        'Complete 12 credits from the locally listed menu'
      );
    const aggregateShape = {
      title: 'Science Specialized Requirements',
      geArea: 'mgcc_science_specialized_destination_aligned', units: 12,
      sourceRefs: ['major', 'science_specialized'],
      constraintKinds: ['destination_selected_open_stem_roster'],
    };
    if (associate.proof.variant === 'authoritative_stored') {
      const storedCarrier = exactMountainStoredCarrierFingerprintBinding({
        variant: associate.proof.variant,
        document_style: associate.proof.document_style,
        carrier_sha256: mountainStoredCarrierFingerprint(document),
      });
      // The authoritative stored tree contains one malformed receiver. It is
      // not ignored or generalized: the raw receiver, duplicate identity,
      // option menu, units, and projection-specific shape are all committed
      // by the style-specific carrier hash above.
      carrierExact = storedCarrier.supported
        && exactAggregateCarrier(specialized, { ...aggregateShape, receiverCount: 1 })
        && exactMenu;
    } else {
      carrierExact = exactAggregateCarrier(specialized, aggregateShape) && exactMenu;
    }
    runtimeSections = [runtimeCarrierSection({
      codes: [...carrier.pair], units: 8, groupIndex: 8,
      groupLabel: 'Science Specialized Requirements — exact Radford chemistry pair',
      sourceRefs: ['major', 'science_specialized'], sourceBoundRule: carrier.rule,
    })];
    assignments = carrier.pair.map((code) => ({
      code, group_index: 8, role: 'locally_listed_science_specialized_course',
    }));
  } else if (row.slug === 'paul-d-camp-community-college') {
    const ucgs = document?.requirement_groups?.[9];
    const transferVa = document?.requirement_groups?.[10];
    carrierExact = exactAggregateCarrier(ucgs, {
      title: 'UCGS natural science', geArea: 'camp_ucgs_natural_science',
      units: 4, sourceRefs: ['major', 'general_education'],
    }) && exactAggregateCarrier(transferVa, {
      title: 'TransferVA-approved science', geArea: 'camp_transferva_approved_science',
      units: 4, sourceRefs: ['major', 'general_education'],
    }) && String(transferVa?.note || '').includes(
      'PHY 202 should be considered only for B.A. Computer Science transfer paths'
    );
    runtimeSections = [
      runtimeCarrierSection({
        codes: ['CHM111'], units: 4, groupIndex: 9,
        groupLabel: 'UCGS natural science — exact Radford choice',
        sourceRefs: ['major', 'general_education'], sourceBoundRule: carrier.rule,
      }),
      runtimeCarrierSection({
        codes: ['CHM112'], units: 4, groupIndex: 10,
        groupLabel: 'TransferVA-approved science — exact Radford choice',
        sourceRefs: ['major', 'general_education'], sourceBoundRule: carrier.rule,
      }),
    ];
    assignments = [
      { code: 'CHM111', group_index: 9, role: 'ucgs_natural_science' },
      { code: 'CHM112', group_index: 10, role: 'transferva_approved_science' },
    ];
  }
  if (!carrierExact) {
    return { applicable: true, ready: false, reason: 'the exact source-bound Radford associate science carrier changed' };
  }
  return {
    applicable: true,
    ready: true,
    rule: carrier.rule,
    pair_codes: [...carrier.pair],
    route_ids: carrier.pair.map(courseIdFor),
    aggregate_units_replaced: carrier.aggregate_units_replaced,
    runtime_sections: runtimeSections,
    proof: {
      source_bound_aggregate_carrier: true,
      associate_tree_sha256: associate.proof.associate_tree_sha256,
      associate_variant: associate.proof.variant,
      publication_readiness_authorized: false,
      ...(row.slug === 'mountain-gateway-community-college'
        && associate.proof.variant === 'authoritative_stored'
        ? { stored_carrier_sha256: mountainStoredCarrierFingerprint(document) }
        : {}),
      source_receipts: sourceReceipts,
      assignments,
    },
  };
}

function radfordAssociateSciencePairCarrier(document) {
  const associate = exactAssociateScienceTree(document);
  if (!associate.supported) {
    return { applicable: true, ready: false, reason: associate.reason };
  }
  return sourceBoundCarrierForExactAssociate(document, associate);
}

function exactRadfordScienceRule(document) {
  const exact = exactRadfordTree(document);
  if (!exact.supported) return exact;
  const group = document?.requirement_groups?.[RADFORD_SCIENCE_GROUP_INDEX];
  const section = group?.sections?.[0];
  const constraint = array(group?.analysis_constraints)
    .filter((entry) => entry?.kind === RADFORD_SCIENCE_RULE);
  const receiver = section?.receivers?.[0];
  if (group?.title !== 'B.S. science requirement'
      || group?.requirement_layer !== 'major'
      || group?.tier !== 'breadth'
      || group?.course_level !== 'lower_division_or_category'
      || group?.cc_articulable !== true
      || constraint.length !== 1
      || section?.section_advisement !== 1
      || section?.unit_advisement !== 6
      || section?.unit_advisement_max !== 8
      || section?.receivers?.length !== 1
      || receiver?.receiving?.kind !== 'ge_area'
      || receiver?.receiving?.code !== 'RADFORD-BS-SCIENCE-WITH-LAB'
      || receiver?.receiving?.units !== 6) {
    return { supported: false, reason: 'the exact Radford two-science carrier or its 6-8 credit range changed' };
  }
  const free = document?.requirement_groups?.[RADFORD_FREE_ELECTIVE_GROUP_INDEX];
  const freeSection = free?.sections?.[0];
  if (free?.title !== 'Open credit capacity after the canonical major and REAL minimum'
      || free?.requirement_layer !== 'university_graduation'
      || free?.tier !== 'breadth'
      || free?.course_level !== 'elective_capacity'
      || free?.cc_articulable !== true
      || freeSection?.unit_advisement !== RADFORD_FREE_ELECTIVE_UNITS
      || freeSection?.unit_advisement_max !== RADFORD_FREE_ELECTIVE_UNITS
      || freeSection?.receivers?.[0]?.receiving?.kind !== 'ge_area'
      || freeSection?.receivers?.[0]?.receiving?.code !== 'RADFORD-OPEN-CREDIT-CAPACITY'
      || freeSection?.receivers?.[0]?.receiving?.units !== RADFORD_FREE_ELECTIVE_UNITS) {
    return { supported: false, reason: 'the exact Radford 35-credit free-elective capacity changed' };
  }
  const evidenceIssue = radfordSciencePairEvidenceIssue(evidence);
  if (evidenceIssue) return { supported: false, reason: evidenceIssue };
  return { ...exact, science_group: group, constraint: constraint[0] };
}

function baseSciencePairContext(document, associateDocument) {
  const claimsRadford = [
    document?.slug, document?._id, document?.va_requirement_id,
    document?.institution_id, document?.school_id, document?.school,
  ].map((value) => String(value ?? '').trim()).some((value) => [
    'radford-university', 'va:degree:radford-university:cs',
    'degree:9219:va-cs', 'va:uni:radford-university', 'va:uni:9219',
    '9219', 'Radford University',
  ].includes(value));
  if (!claimsRadford) return { applicable: false, ready: false };
  const bachelor = exactRadfordScienceRule(document);
  if (!bachelor.supported) {
    return { applicable: true, ready: false, reason: bachelor.reason };
  }
  const associate = exactAssociateScienceTree(associateDocument);
  if (!associate.supported) {
    return { applicable: true, ready: false, reason: associate.reason };
  }
  const carrier = sourceBoundCarrierForExactAssociate(associateDocument, associate);
  if (!carrier.ready) {
    return { applicable: true, ready: false, reason: carrier.reason };
  }
  const richardBland = associate.row.slug === RICHARD_BLAND_SLUG
    ? exactRichardBlandPairEvidence() : null;
  if (richardBland && !richardBland.supported) {
    return { applicable: true, ready: false, reason: richardBland.reason };
  }
  const pair = richardBland
    ? [...richardBland.pair]
    : carrier.pair_codes.map((code) => factsBySendingCode.get(code));
  if (pair.length !== 2 || pair.some((fact) => !fact)
      || pair[0].sending_course_id === pair[1].sending_course_id
      || pair.some((fact) => ![3, 4].includes(fact.sending_credits))
      || !pair.some((fact) => fact.sending_lab_hours > 0)
      || pair.reduce((sum, fact) => sum + fact.sending_credits, 0)
        !== RADFORD_PAIR_SENDING_UNITS
      || pair.reduce((sum, fact) => sum + fact.receiving_credits, 0)
        !== RADFORD_PAIR_RECEIVING_UNITS) {
    return { applicable: true, ready: false, reason: 'the exact distinct science pair, units, or laboratory receipt changed' };
  }
  let pairSpecificReceipts;
  let evidenceFactsSha256;
  let equivalencyReceiptsSha256;
  if (richardBland) {
    pairSpecificReceipts = richardBland.receipts;
    evidenceFactsSha256 = richardBland.facts_sha256;
    equivalencyReceiptsSha256 = richardBland.facts_sha256;
  } else {
    const collegeEvidenceIssue = radfordCollegeSciencePairEvidenceIssue(
      collegeEquivalencyEvidence,
    );
    if (collegeEvidenceIssue) {
      return { applicable: true, ready: false, reason: collegeEvidenceIssue };
    }
    const pairSpecificProofs = pair.map((fact) => exactPositiveReceipt(
      collegeEquivalencyEvidence,
      associate.row.slug,
      fact.sending_code,
    ));
    if (pairSpecificProofs.some((proof) => !proof.supported)) {
      return {
        applicable: true,
        ready: false,
        reason: `the retained Radford equivalency evidence does not contain both college-specific ${associate.row.name} science-pair receipts`,
      };
    }
    pairSpecificReceipts = pairSpecificProofs.map((proof) => proof.receipt);
    evidenceFactsSha256 = evidence.facts_sha256;
    equivalencyReceiptsSha256 = collegeEquivalencyEvidence.receipts_sha256;
  }
  return {
    applicable: true, ready: true,
    associate: associate.proof,
    associate_carrier: carrier,
    bachelor: bachelor.proof,
    college: associate.row,
    pair,
    pair_ids: pair.map((fact) => fact.sending_course_id),
    receiving_ids: pair.map((fact) => fact.receiving_parent_id),
    source_bound_required_any_id_sets: [pair.map((fact) => fact.sending_course_id)],
    sending_units: RADFORD_PAIR_SENDING_UNITS,
    receiving_units: RADFORD_PAIR_RECEIVING_UNITS,
    free_elective_displacement: RADFORD_PAIR_CAPACITY_DISPLACEMENT,
    remaining_free_elective_units: RADFORD_REMAINING_FREE_ELECTIVE_UNITS,
    evidence_facts_sha256: evidenceFactsSha256,
    college_equivalency_receipts_sha256: equivalencyReceiptsSha256,
    college_equivalency_receipts: richardBland
      ? pairSpecificReceipts.map((receipt) => ({ ...receipt }))
      : pairSpecificReceipts.map((receipt) => ({
        sending_code: receipt.sending_code,
        receiving_code: receipt.receiving_code,
        discovery_notes: receipt.discovery?.route?.notes || null,
        source_url: receipt.source.final_url,
        response_sha256: receipt.source.response_sha256,
      })),
    equivalency_evidence_scope: richardBland
      ? 'exact_retained_owner_local_course_receipts'
      : 'rebuilt_college_specific_agreement_edges',
  };
}

function sourceEquivalencySort(left, right) {
  return number(left?.sending_course_id) - number(right?.sending_course_id)
    || number(left?.receiving_parent_id) - number(right?.receiving_parent_id)
    || text(left?.sending_course_key).localeCompare(text(right?.sending_course_key))
    || text(left?.sending_code).localeCompare(text(right?.sending_code))
    || text(left?.receiving_identifier).localeCompare(text(right?.receiving_identifier))
    || text(left?.receiving_name).localeCompare(text(right?.receiving_name))
    || String(text(left?.receiving_notes) ?? '')
      .localeCompare(String(text(right?.receiving_notes) ?? ''))
    || String(text(left?.sending_source_url) ?? '')
      .localeCompare(String(text(right?.sending_source_url) ?? ''));
}

function normalizedSourceEquivalencyRow(row) {
  return {
    sending_course_id: number(row?.sending_course_id),
    sending_course_key: text(row?.sending_course_key),
    sending_code: text(row?.sending_code),
    receiving_identifier: text(row?.receiving_identifier),
    receiving_name: text(row?.receiving_name),
    receiving_notes: row?.receiving_notes == null ? null : text(row.receiving_notes),
    receiving_parent_id: number(row?.receiving_parent_id),
    sending_source_url: text(row?.sending_source_url),
  };
}

function sourceEquivalenciesSha256(rows) {
  return createHash('sha256').update(JSON.stringify(
    array(rows).map(normalizedSourceEquivalencyRow),
  )).digest('hex');
}

function exactSourceEquivalencyRows(agreement, { allowEmpty = false } = {}) {
  const rows = array(agreement?.source_equivalencies);
  if (!rows.length && !allowEmpty) {
    return { supported: false, reason: 'the rebuilt agreement has no concrete source-equivalency channel' };
  }
  const exactKeys = [
    'receiving_identifier', 'receiving_name', 'receiving_notes',
    'receiving_parent_id', 'sending_code', 'sending_course_id',
    'sending_course_key', 'sending_source_url',
  ];
  if (rows.some((row) => (
    JSON.stringify(Object.keys(row || {}).sort()) !== JSON.stringify(exactKeys)
  ))) {
    return { supported: false, reason: 'the rebuilt agreement concrete source-equivalency row schema changed' };
  }
  if (agreement?.source_equivalencies_contract !== 'va-concrete-supply-edge-v2'
      || number(agreement?.source_equivalencies_count) !== rows.length
      || text(agreement?.source_equivalencies_sha256) !== sourceEquivalenciesSha256(rows)
      || number(agreement?.derived_from?.supply_edges) == null
      || number(agreement?.derived_from?.supply_edges) < rows.length) {
    return { supported: false, reason: 'the rebuilt agreement concrete source-equivalency count, hash, or supply receipt changed' };
  }
  for (const row of rows) {
    const sendingCode = canonicalCourseCode(row?.sending_code);
    const sendingKey = text(row?.sending_course_key);
    const receivingIdentifier = canonicalCourseCode(row?.receiving_identifier);
    const receivingName = text(row?.receiving_name);
    const receivingNotes = row?.receiving_notes == null ? null : text(row.receiving_notes);
    const sendingSourceUrl = text(row?.sending_source_url);
    let sendingIdentity = null;
    if (sendingKey === `va:${sendingCode}`) {
      sendingIdentity = {
        course_id: courseIdFor(sendingCode),
        course_key: sendingKey,
      };
    } else if (sendingKey === `${agreement?.college_id}:${sendingCode}`) {
      sendingIdentity = institutionCourseIdentity(agreement.college_id, sendingCode);
    }
    if (parseCourseCode(sendingCode).kind !== 'concrete'
        || parseCourseCode(receivingIdentifier).kind !== 'concrete'
        || !sendingIdentity
        || number(row?.sending_course_id) !== sendingIdentity.course_id
        || sendingKey !== sendingIdentity.course_key
        || text(row?.sending_code) !== sendingCode
        || text(row?.receiving_identifier) !== receivingIdentifier
        || !receivingName
        || !/^https:\/\/www\.transfervirginia\.org\/course\/[A-F0-9]+$/i.test(sendingSourceUrl)
        || (row?.receiving_notes != null && !receivingNotes)
        || number(row?.receiving_parent_id) !== parentIdForLanding({
          identifier: receivingIdentifier, name: receivingName,
        })) {
      return { supported: false, reason: 'the rebuilt agreement concrete source-equivalency identity contract changed' };
    }
  }
  const sorted = [...rows].sort(sourceEquivalencySort);
  if (rows.some((row, index) => row !== sorted[index])) {
    return { supported: false, reason: 'the rebuilt agreement concrete source-equivalency channel is not canonically sorted' };
  }
  const keys = rows.map((row) => JSON.stringify([
    row.sending_course_id, row.sending_course_key, row.sending_code,
    row.receiving_identifier, row.receiving_parent_id,
  ]));
  if (new Set(keys).size !== keys.length) {
    return { supported: false, reason: 'the rebuilt agreement concrete source-equivalency channel contains duplicate edges' };
  }
  return { supported: true, rows };
}

function exactPairAgreement(context, agreements) {
  if (!Array.isArray(agreements) || agreements.length !== 1) {
    return { supported: false, reason: 'the exact Radford pair must come from one rebuilt agreement' };
  }
  const agreement = agreements[0];
  const expectedId = `va:agreement:9219:${context.college.numeric_id}`;
  if (agreement?._id !== expectedId
      || agreement?.university_id !== 'va:uni:radford-university'
      || agreement?.college_id !== `va:cc:${context.college.slug}`
      || number(agreement?.uc_school_id) !== 9219
      || number(agreement?.community_college_id) !== context.college.numeric_id
      || agreement?.university_name !== 'Radford University'
      || agreement?.college_name !== context.college.name
      || agreement?.major !== 'Computer Science, B.S.'
      || agreement?.state !== 'va'
      || agreement?.source
        !== 'derived from Transfer Virginia course equivalencies × published degree requirements'
      || agreement?.pairing !== 'course-equivalency-join'
      || agreement?.derived_from?.degree_id !== 'va:degree:radford-university:cs'
      || agreement?.source_equivalencies_contract !== 'va-concrete-supply-edge-v2') {
    return { supported: false, reason: 'the rebuilt Radford agreement identity or pair binding changed' };
  }
  const ownerLocalEvidence = context.equivalency_evidence_scope
    === 'exact_retained_owner_local_course_receipts';
  const source = exactSourceEquivalencyRows(agreement, { allowEmpty: ownerLocalEvidence });
  if (!source.supported) return source;
  if (ownerLocalEvidence) {
    for (const fact of context.pair) {
      const sameCode = source.rows.filter((row) => (
        text(row?.sending_code) === fact.sending_code
      ));
      const exact = sameCode.filter((row) => (
        number(row?.sending_course_id) === fact.sending_course_id
          && text(row?.sending_course_key) === fact.sending_course_key
          && text(row?.receiving_identifier) === fact.receiving_code
          && text(row?.receiving_name) === fact.receiving_name
          && (row?.receiving_notes == null ? null : text(row.receiving_notes))
            === fact.receiving_notes
          && number(row?.receiving_parent_id) === fact.receiving_parent_id
          && text(row?.sending_source_url) === fact.sending_source_url
      ));
      // The current agreement builder predates owner-local equivalency
      // overlays, so absence here is allowed only because the exact retained
      // artifact is the pair channel. Any same-code row must already be the
      // one exact owner-local edge; a statewide collision fails closed.
      if (sameCode.length && (sameCode.length !== 1 || exact.length !== 1)) {
        return {
          supported: false,
          reason: `the rebuilt ${context.college.name} agreement contradicts the exact owner-local ${fact.sending_code} receipt`,
        };
      }
    }
    return {
      supported: true,
      agreement_id: agreement._id,
      pair_channel: 'exact_retained_owner_local_course_receipts',
    };
  }
  for (const fact of context.pair) {
    const matches = source.rows.filter((row) => (
      number(row?.sending_course_id) === fact.sending_course_id
      && text(row?.sending_course_key) === fact.sending_course_key
      && text(row?.sending_code) === fact.sending_code
      && text(row?.receiving_identifier) === fact.receiving_code
      && text(row?.receiving_name) === fact.receiving_name
      && (row?.receiving_notes == null ? null : text(row.receiving_notes))
        === fact.receiving_notes
      && number(row?.receiving_parent_id) === fact.receiving_parent_id
      && text(row?.sending_source_url) === fact.sending_source_url
    ));
    if (matches.length !== 1) {
      return {
        supported: false,
        reason: `the rebuilt ${context.college.name} agreement does not carry exactly one exact ${fact.sending_code} to ${fact.receiving_code} source edge`,
      };
    }
  }
  return { supported: true, agreement_id: agreement._id };
}

function radfordSciencePairRuntimeContext(
  document,
  associateDocument,
  { degreeCourseSet, unitsById, agreements } = {},
) {
  const context = baseSciencePairContext(document, associateDocument);
  if (!context.ready) return context;
  if (!(degreeCourseSet instanceof Set) || !(unitsById instanceof Map)) {
    return { ...context, ready: false, reason: 'the exact Radford pair runtime identity maps are absent' };
  }
  for (let index = 0; index < context.pair.length; index += 1) {
    const fact = context.pair[index];
    if (!degreeCourseSet.has(fact.sending_course_id)
        || Number(unitsById.get(fact.sending_course_id)) !== fact.sending_credits) {
      return { ...context, ready: false, reason: `the ${fact.sending_code} source-tree identity or four-credit receipt changed` };
    }
  }
  const agreement = exactPairAgreement(context, agreements);
  if (!agreement.supported) return { ...context, ready: false, reason: agreement.reason };
  return { ...context, agreement_id: agreement.agreement_id };
}

function applyRadfordSciencePair(state, context, planSet) {
  if (!context?.ready || !(planSet instanceof Set)
      || !context.pair_ids.every((id) => planSet.has(id))) {
    return { applied: false, reason: 'the selected exact A.S. plan does not contain the complete Radford science pair' };
  }
  if (context.pair_ids.some((id) => state.directIds.has(id))) {
    return { applied: false, reason: 'a Radford science-pair sending course was already spent by another bachelor requirement' };
  }
  state.directAppliedUnits += context.sending_units;
  state.lowerDirectAppliedUnits += context.sending_units;
  for (const id of context.pair_ids) {
    state.directIds.add(id);
    state.lowerDirectIds.add(id);
  }
  state.sourceBoundRadfordSciencePair = {
    college: context.college.name,
    sending_codes: context.pair.map((fact) => fact.sending_code),
    receiving_codes: context.pair.map((fact) => fact.receiving_code),
    sending_units: context.sending_units,
    receiving_units: context.receiving_units,
    free_elective_displacement: context.free_elective_displacement,
    remaining_free_elective_units: context.remaining_free_elective_units,
    evidence_facts_sha256: context.evidence_facts_sha256,
    college_equivalency_receipts_sha256: context.college_equivalency_receipts_sha256,
    college_equivalency_source_urls: context.college_equivalency_receipts
      .map((receipt) => receipt.source_url),
    college_equivalency_discovery_notes: context.college_equivalency_receipts
      .map((receipt) => receipt.discovery_notes),
    associate_carrier_rule: context.associate_carrier.rule,
    associate_carrier_aggregate_units_replaced:
      context.associate_carrier.aggregate_units_replaced,
    equivalency_scope: 'college_specific_transfer_virginia_receipts',
  };
  return { applied: true };
}

module.exports = {
  ASSOCIATE_MATRIX,
  ASSOCIATE_TREE_SHA256,
  ASSOCIATE_VARIANT_BINDINGS,
  AUTHORITATIVE_STORED_VARIANTS,
  MOUNTAIN_STORED_CARRIER_SHA256,
  RADFORD_FREE_ELECTIVE_GROUP_INDEX,
  RADFORD_PAIR_CAPACITY_DISPLACEMENT,
  RADFORD_REMAINING_FREE_ELECTIVE_UNITS,
  RICHARD_BLAND_OWNER,
  RICHARD_BLAND_PAIR,
  RADFORD_SCIENCE_GROUP_INDEX,
  RADFORD_SCIENCE_GROUP_PATH,
  RADFORD_SCIENCE_RULE,
  SOURCE_BOUND_CARRIER_EVIDENCE,
  applyRadfordSciencePair,
  associateScienceTreeFingerprint,
  associateSourceIdentityFingerprint,
  associateVerificationFingerprint,
  baseSciencePairContext,
  exactAssociateScienceTree,
  exactAssociateVariantFingerprintBinding,
  exactMountainStoredCarrierFingerprintBinding,
  exactPairAgreement,
  exactRichardBlandPairEvidence,
  exactRadfordScienceRule,
  normalizedAssociateScienceTree,
  mountainStoredCarrierFingerprint,
  radfordAssociateSciencePairCarrier,
  radfordSciencePairRuntimeContext,
  sourceEquivalenciesSha256,
};
