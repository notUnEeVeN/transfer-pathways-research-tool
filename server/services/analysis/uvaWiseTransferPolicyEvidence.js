const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'uva_wise_2026_2027_vccs_gaa_policy_evidence';
const CATALOG_YEAR = '2026-2027';
const REGISTRAR_URL = 'https://www.uvawise.edu/registrar/transferring-courses';
const GAA_URL =
  'https://www.uvawise.edu/sites/default/files/attachments/pages/2024-11/'
  + 'UVA%20Wise_VCCS_GAA_Final%20with%20Signatures%206.14.2023.pdf';
const ROBOTS_URL = 'https://www.uvawise.edu/robots.txt';
const USER_AGENT =
  'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const RESPONSE_SHA256 = Object.freeze({
  registrar: '31364c400980bca253526a9127ad7885d24fff5353765093c26eb7070f00b1fa',
  gaa_pdf: 'e4df7fc120c4d0c21e53c89e8dbc6a789982c432c1b198099adbdc4c9eb0ef5a',
  gaa_text: '073d4792d41d059b52160c7a2c1ec68fd2fb9f36978e8006a1df6e59d63d6251',
  robots: '773fb8d35bb9a39d35335ee6db8dc5c912d2aacbfb823152d9c61cd647dd902d',
});

const RESPONSE_BYTES = Object.freeze({
  registrar: 48134,
  gaa_pdf: 299248,
  gaa_text: 11639,
  robots: 2027,
});

const EXPECTED = Object.freeze({
  registrar: Object.freeze({
    title: 'Transferring Courses | UVA Wise',
    heading: 'Transferring Courses',
    virginia_heading: 'Virginia Transfer Applicants',
    cohort_heading: 'Students from Virginia Community Colleges and Richard Bland College',
    admission:
      'Transfer applicants from a Virginia Community College or Richard Bland College who have earned an Associate of Arts, Associate of Science, or Associate of Arts and Sciences degree based on a baccalaureate-oriented sequence of courses are guaranteed admission to UVA Wise, within limits defined in the College Catalog.',
    ge_waiver:
      'Students who have earned an Associate of Arts, Associate of Science, or Associate of Arts and Sciences degree based on a baccalaureate-oriented sequence of courses from a public Virginia Community College and are participants in the Guaranteed Admission Program (GAP) will have met the lower division general education requirements of UVA Wise. These students will be classified as juniors, and will be given preference in the admissions process.',
    transfer_module:
      'Transfer students from a Virginia Community College and Richard Bland College who have completed the state-approved Transfer Module but who have not earned an associate degree will receive 35 hours of credit for these courses and will have met the general education requirements for English composition, humanities, western heritage, and natural science. They will have partially met the lower division general education requirements in social science and mathematics. They will not necessarily have met the lower division general education requirements in literature, physical education, foreign language, or the arts. Students who complete the transfer module will be given preference in the admissions process.',
    agreement_heading: 'Articulation Agreements',
    agreement_link: 'Guaranteed Admission Agreement – Virginia Community College System',
    major_authority:
      'Evaluations of transfer credit are prepared under the authority of academic departments, which reserve final decisions relative to the application of transfer credit to degree requirements in the major.',
    major_disputes:
      'In the case of disputes between transfer students and academic departments relative to the application of transfer credit to degree requirements, the Registrar generally is able to resolve the problem satisfactorily. In cases where conflicts cannot be resolved at the department level, they are referred to the Academic Dean who has the final authority.',
  }),
  gaa: Object.freeze({
    title: 'TRANSFER AGREEMENT WITH GUARANTEED ADMISSION BETWEEN THE UNIVERSITY OF VIRGINIA’S COLLEGE AT WISE AND THE VIRGINIA COMMUNITY COLLEGE SYSTEM',
    prior_agreements:
      'This agreement supersedes all previous agreements between UVA Wise and the VCCS or its individual institutions signed prior to January 2023. It does not nullify individual program-to-program agreements articulated since this date.',
    awards:
      'Transfer-oriented associate degrees include Associate of Arts (AA), Associate of Science (AS), and Associate of Arts & Sciences (AA&S) degrees identified by the State Council of Higher Education for Virginia (SCHEV) as university-parallel transfer degrees.',
    general_studies:
      'Only those AS or AA&S in General Studies degrees identified by SCHEV as transfer degrees qualify for this UVA Wise GAA',
    gpa:
      'A minimum grade point average (GPA) of 2.5 or higher on a four-point scale is required.',
    passing_credit:
      'UVA Wise will guarantee the acceptance of all transferrable credits with a passing grade (a passing grade is any grade above a D and includes those credits with COVID-related grades) not to exceed 62 credits. Courses with failing grades will not be accepted.',
    associate_residency:
      'Students are required to earn an associate degree with 60 or more credits; a minimum of 30 credits must be completed at the degree-granting institution.',
    all_degree_credits:
      'All credits contained in the transfer-oriented associate degree will be accepted, not to exceed 62 credits.',
    gap_form:
      'Students interested in taking advantage of guaranteed admission must apply to UVA Wise and fill out the Guaranteed Admission (GAP) form found online at www.uvawise.edu/apply.',
    intent_not_required:
      'A student can still participate in the GAA without registering the intent to use the agreement through the Transfer Virginia portal.',
    ge_waiver:
      'Upon completion of the transferable associate degree, all lower division general education requirements will be met upon admission to UVA Wise.',
    catalog_and_degree_application:
      'Students may choose the catalog in effect at the time of the student’s first post high school enrollment as long as it is within eight (8) years of admission to UVA Wise. Students will have all lower general education requirements met and 60 credit hours will apply to the bachelor’s degree requirement of 120 hours. Students must meet the requirements of their chosen major.',
    duration:
      'This agreement will remain in effect until modified or terminated. This Agreement may be modified only by mutual agreement by the VCCS Chancellor and Chancellor of UVA Wise. Termination may be made by either party upon one (1) year prior written notice.',
    effective_date:
      'The effective date of this Agreement is the date last signed by the Chancellor of UVA Wise and the VCCS Chancellor.',
    signatures: Object.freeze(['06/13/2023', '6/14/2023']),
  }),
});

// This is the paper's exact 18-member VCCS A.S. sender cohort.  Every row is
// bound twice: the live protected va_requirements projection and the proposed
// candidate projection.  The two hashes are not interchangeable.  Richard
// Bland (9317) is intentionally absent because it is neither a VCCS member nor
// a party to the signed agreement.
const VCCS_SENDER_RECEIPTS = Object.freeze([
  ['blue-ridge-community-college', 9301, 'Blue Ridge Community College', 'brcc', '11.0701', 'Associate of Science in Computer Science', '246.AssociateofScienceinComputerScience', 231536, 'Computer Science (11.0701)', '2b25b54fbb7b9d029cde78b3544cac6706c001114f9596aae532d152b92bdf99', '1e66df8c035c93bbff8aae0bacca3cdbf23455b88c90767f9330cdd55b31519c', 'abbc11169ae8def70573bfaae2d0e707c7ef445079214a5c38d75ed12663bb45', '8f92c6df8d0360af1a7e4a24c92cb3649834ec775df012f6a2238e7fb5869f5e'],
  ['brightpoint-community-college', 9302, 'Brightpoint Community College', 'brightpoint', '11.0701', 'Associate of Science Degree in Computer Science', '246-01.AssociateofScienceDegreeinComputerScience', 232450, 'Computer Science (11.0701)', 'c5be273cc14922c43e6d0e4478137c8f445a7006947df36688d011f53d052ea1', '9377d96cb7591c4e7e7e0a6c19f74fa991f4e650dd00fbdfafc2080cc8f0e127', 'c5be273cc14922c43e6d0e4478137c8f445a7006947df36688d011f53d052ea1', '9377d96cb7591c4e7e7e0a6c19f74fa991f4e650dd00fbdfafc2080cc8f0e127'],
  ['central-virginia-community-college', 9303, 'Central Virginia Community College', 'cvcc', '11.0701', 'Associate of Science in Computer Science', '246.AssociateofScienceinComputerScience', 231697, 'Computer Science (11.0701)', '13ce276ee6c3642a2db16e0214c87bd8f6a12239efbe5c94d3f48f5263d5d884', '11f6bd31e3fde77216ba8111f6201ba6d01a9b2e0a42264d5d637dcb87d5b4ec', '0423d6052f467ff537d048732ddef701a7ea6efb9f9c832271259a6ab36b41f6', 'f54cf983932917104f8e68e2baec512198df1143f9a1faa306b387fdea88f4a3'],
  ['germanna-community-college', 9306, 'Germanna Community College', 'gcc', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 232195, 'Computer Science (11.0701)', 'b297d462c7264a391a5e78acd87015c0fcf1ac35fedcefb70d4961304278d5ba', '6cc84233f18b92181e325d46fa4b8e4fc6df96534e5f1087acd55595f4d3089d', '8bd3d46c00fb0a4261c13a4b5364eefb3d8ed5e2b3117bc4fcd4e707cbf21980', '96e547d361bc5a5bc5eb3927204003e6c8fe43ec5f42dc763ca5f1f508134347'],
  ['j-sargeant-reynolds-community-college', 9307, 'J Sargeant Reynolds Community College', 'reynolds', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 232414, 'Computer Science (11.0701)', '5d520c60b011fbec1b29ca9163018d916c535cd7f55a23662fc81e1c0d666278', 'a339de3ee9f1a4b614ce02096a89a8198987a9ae772d41070538545a6e5c4063', '8db587598e37b7e05ee45be734b461f8528dceb39909c4049aad2bc84a06b65b', '1f2d684fd6499a1620a05403d607f029edf8e4b31dfadaaff77c29507e272c85'],
  ['laurel-ridge-community-college', 9308, 'Laurel Ridge Community College', 'laurelridge', '11.0701', 'Associate of Science Degree in Computer Science', '246.AssociateofScienceDegreeinComputerScience', 232575, 'Computer Science (11.0701)', '7e2f93069b9cc8b725540d1b7cd1c9e68bfcdd902b47861bebd92228c154e4c0', '43bc4e10da0fb5ac96b343d4ea3b2f6526d508b4d75d019d9008b325cda37753', '7e2f93069b9cc8b725540d1b7cd1c9e68bfcdd902b47861bebd92228c154e4c0', '43bc4e10da0fb5ac96b343d4ea3b2f6526d508b4d75d019d9008b325cda37753'],
  ['mountain-gateway-community-college', 9310, 'Mountain Gateway Community College', 'mgcc', '30.0101', 'Associate of Science Degree in Science', '880.AssociateofScienceDegreeinScience', 231873, 'Biological and Physical Sciences (30.0101)', '2c688475f1da92bf51c46b0b5cf7574251a82e426635aee3637491a366b42be0', 'b4c04f89b06e5db6f95099504c2739d962c01a3b4bcb2631c5df76c8280f1454', 'd9d62f38fd9f39cb89d3da1fa5c9ffbfe06bb698b400ef0030eb99a56ed83a79', '8ff77a3547b4cd46b6d4113c11802f2f6fa3ac72f443f20baff12a914628e766'],
  ['new-river-community-college', 9311, 'New River Community College', 'nrcc', '11.0701', 'Associate of Science in Computer Science', '246.AssociateofScienceinComputerScience', 232867, 'Computer Science (11.0701)', '2eb566b844869dd6e1dd2eca09a181f3fc29eb4a3780c93adb2a2af4d36ac20d', '3061491ad15b2b3d3dd2378b1ac9db0e8e3a87936f721b560d1ef53530fc5dd0', '2eb566b844869dd6e1dd2eca09a181f3fc29eb4a3780c93adb2a2af4d36ac20d', '4bf1063c53300e139fb3267b49c2f44b8316993679970ad54fd97a7de3da2403'],
  ['northern-virginia-community-college', 9312, 'Northern Virginia Community College', 'nova', '11.0701', 'Associate of Science in Computer Science Degree', '2460.AssociateofScienceinComputerScienceDegree', 232946, 'Computer Science (11.0701)', 'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f', '12523a6de9d8f7fb63691dbb212eafbe06be910237051c993a3b69c5bed896bd', 'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f', '1a6b995e2defd8bb579c4187de00cbb1ecab56fad82828cfc7be39c4ecbf99f2'],
  ['paul-d-camp-community-college', 9314, 'Paul D. Camp Community College', 'camp', '11.0701', 'Associate of Science in Computer Science', '246.AssociateofScienceinComputerScience', 233037, 'Computer Science (11.0701)', 'dada36fc64828ffc5a2063947e53630000842e0e616a7755bad80787bb2a03ea', 'cb446dacc1da1efdc3070e80691b158a62c7b71de6f1748bbde0ba1ef7e7456a', '0c5760c092672fd03a7f25952ef33da999d89b1e841d2650326d51df9f85d071', '3865adca37f86847aebdf1d47d9edd762ba26a96ea3d26edbdde2dbcb7a1d637'],
  ['piedmont-virginia-community-college', 9315, 'Piedmont Virginia Community College', 'pvcc', '11.0701', 'Associate of Science Degree in Computer Science', '246.AssociateofScienceDegreeinComputerScience', 233116, 'Computer Science (11.0701)', '325429f8c94132adc593b0c6a2a5c037b22f5d3cb75983f2789d37a56f525db7', '290b48aebe857f7485e637c8d8cf50829d37248a91ef218475359e6a7ee9217d', '325429f8c94132adc593b0c6a2a5c037b22f5d3cb75983f2789d37a56f525db7', '290b48aebe857f7485e637c8d8cf50829d37248a91ef218475359e6a7ee9217d'],
  ['rappahannock-community-college', 9316, 'Rappahannock Community College', 'rcc', '30.0101', 'Associate of Science Degree in Science', '880.AssociateofScienceDegreeinScience', 233310, 'Biological and Physical Sciences (30.0101)', 'c804c0c017e4c78c22cb76e757c3b5ca8f4ae99bddb12f83cb6ba402ddd49555', 'b6c679971f734fb474e98e08714ee2fe7c52633773674c544050bfe8b7158ddd', '542140ae69475ff93426ef6c1dc5de6c0f65988f610b046fc0d539b87fe1cf25', '16a4a57af3678e6def51447a834566fdad697e577a56c4f434f9d5832abd482e'],
  ['southwest-virginia-community-college', 9319, 'Southwest Virginia Community College', 'swcc', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 233648, 'Computer Science (11.0701)', '0dfe87d22adef2dcc0588b3c13e7fab92748c027add477fd087f91f93a981d1c', '24c24bafbe660258d572513b30d8684c4ead09bca039c2bd3ff0a5f3dc4c0b98', 'ef50004db5ad78feb6d768aa5a29e548039b77fdbbd9f4df2a13beb9c3fb8ada', '701d9fdae8daca4cae7fca3fbde04f1bdad93ea62b949407a88dec33c5940d66'],
  ['tidewater-community-college', 9320, 'Tidewater Community College', 'tcc', '11.0701', 'Associate of Science: Computer Science', '246.AssociateofScienceComputerScience', 233772, 'Computer Science (11.0701)', '9baba94d24a5fd9bcac8880741722005ddb5da00dca3a31d69e9bf0c26829140', 'fe5dedeb2333eb32b9a06e886cc15fa829fdfa119e16f79cd35d72e9d8451128', '93932f97995a37ae41f0691b2e2fac838df4e826d2cb1179d94ebbc1bce2282f', '848b3b7e4f2fe6351ed64c5a44e15874a6b039222b44471d2ce2e30ca46bf824'],
  ['virginia-highlands-community-college', 9321, 'Virginia Highlands Community College', 'vhcc', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 233903, 'Computer Science (11.0701)', 'c9419c1a650739480d98f045548565cdd069abae0983531c4e5fda9c722778b0', '992db0b6b8143cd6188db48938bfc2cd4b051e7a282df9612b46e3266f8e704b', 'c9419c1a650739480d98f045548565cdd069abae0983531c4e5fda9c722778b0', '992db0b6b8143cd6188db48938bfc2cd4b051e7a282df9612b46e3266f8e704b'],
  ['virginia-peninsula-community-college', 9322, 'Virginia Peninsula Community College', 'vpcc', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 233754, 'Computer Science (11.0701)', '54add759b298332791fe65fcac7d2e6750ac560c4cef016b3486ca78e0dbecd1', 'd73fd62dec282fc54f3f1e5bd1341c6e1e4c76157d7004d3a6689645d487c284', '24c152befa8d63552fa3df4a364c844c8afcd2e190bfbb79271250800484fc87', 'ef9a8677b57b9fc6b2334573385ac319cfedc116bd70f628bc25bfd2abc1c674'],
  ['virginia-western-community-college', 9323, 'Virginia Western Community College', 'vwcc', '11.0701', 'Associate of Science in Computer Science Degree', '246.AssociateofScienceinComputerScienceDegree', 233949, 'Computer Science (11.0701)', 'ad5f2ba8cff0958f6aeb2dc9267ec21a010fd54b34692c632519894e590197cd', '23088e851a62c84338caa549778b47148a0f835c47ab39834870e78e56b144ef', 'ad5f2ba8cff0958f6aeb2dc9267ec21a010fd54b34692c632519894e590197cd', '23088e851a62c84338caa549778b47148a0f835c47ab39834870e78e56b144ef'],
  ['wytheville-community-college', 9324, 'Wytheville Community College', 'wcc', '30.0101', 'Associate of Science in Science Degree Computer Science Major', '880-01.AssociateofScienceinScienceDegreeComputerScienceMajor', 234377, 'Biological and Physical Sciences (30.0101)', 'f0e904d0aeb67c27a6679585cf566af1ebd6ccd46c2af8568685e64f04b2d60e', '7d66b81e92d18a997d907a71763fe9870584e233f49a1d28e035bf41fb1f2760', 'f0e904d0aeb67c27a6679585cf566af1ebd6ccd46c2af8568685e64f04b2d60e', '7d66b81e92d18a997d907a71763fe9870584e233f49a1d28e035bf41fb1f2760'],
].map(([
  slug, numeric_id, name, vccs_slug, cip_code, vccs_degree_title,
  vccs_major_path, schev_unit_id, schev_program_name,
  source_bundle_sha256, pair_tree_sha256,
  protected_source_bundle_sha256, protected_pair_tree_sha256,
]) => Object.freeze({
  slug, numeric_id, name, vccs_slug, cip_code, vccs_degree_title,
  vccs_major_path, schev_unit_id, schev_program_name,
  source_bundle_sha256, pair_tree_sha256,
  protected_source_bundle_sha256, protected_pair_tree_sha256,
  source_id: `va:as:${slug}:cs`,
  projection_id: `as_degree:${numeric_id}:va-cs:local_as`,
  projection_college_id: `va:cc:${numeric_id}`,
  vccs_program_url: `https://courses.vccs.edu/colleges/${vccs_slug}/programs/${cip_code}-${cip_code === '11.0701' ? 'ComputerScience' : 'Science'}`,
  schev_program_url: `https://research.schev.edu/programbasics/${schev_unit_id}/current/20/${cip_code.replace('.', '')}`,
})));

const normalize = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2010-\u2015]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const semanticSha256 = (value) => sha256(JSON.stringify(stable(value)));

function normalizedUvaWiseVccsSenderTree(document) {
  return {
    catalog_year: document?.catalog_year || null,
    total_units: document?.total_units ?? null,
    total_units_max: document?.total_units_max ?? null,
    degree_type: document?.degree_type || null,
    source_degree_type: document?.source_degree_type || null,
    state: document?.state || null,
    provenance: { source_bundle_hash: document?.provenance?.source_bundle_hash || null },
    analysis_contract: document?.analysis_contract || null,
    unit_audit: document?.unit_audit || null,
    data_quality_flags: document?.data_quality_flags || [],
    requirement_groups: document?.requirement_groups || [],
  };
}

function uvaWiseVccsSenderTreeFingerprint(document) {
  return semanticSha256(normalizedUvaWiseVccsSenderTree(document));
}

function robotsAllows(url, robotsText) {
  const target = new URL(url).pathname;
  const disallowed = String(robotsText || '').split(/\r?\n/)
    .map((line) => line.match(/^\s*Disallow:\s*(\S*)\s*$/i)?.[1] || null)
    .filter(Boolean);
  return !disallowed.some((prefix) => target.startsWith(prefix));
}

function exactTextCount(values, expected, issue, issues) {
  if (values.filter((value) => normalize(value) === normalize(expected)).length !== 1) {
    issues.push(issue);
  }
}

function parseRegistrar(html, issues) {
  const source = String(html || '');
  const $ = cheerio.load(source);
  const paragraphs = $('p').map((index, element) => normalize($(element).text())).get();
  const contentNodes = $('p,li').map((index, element) => normalize(
    $(element).clone().children('ul,ol').remove().end().text(),
  )).get();
  const headings = $('h1,h2,h3').map((index, element) => normalize($(element).text())).get();
  if (normalize($('title').text()) !== EXPECTED.registrar.title) issues.push('registrar:title');
  exactTextCount(headings, EXPECTED.registrar.heading, 'registrar:heading', issues);
  exactTextCount(headings, EXPECTED.registrar.virginia_heading, 'registrar:virginia_heading', issues);
  exactTextCount(headings, EXPECTED.registrar.cohort_heading, 'registrar:cohort_heading', issues);
  exactTextCount(paragraphs, EXPECTED.registrar.admission, 'registrar:admission', issues);
  exactTextCount(paragraphs, EXPECTED.registrar.ge_waiver, 'registrar:ge_waiver', issues);
  exactTextCount(paragraphs, EXPECTED.registrar.transfer_module, 'registrar:transfer_module', issues);
  exactTextCount(contentNodes, EXPECTED.registrar.major_authority, 'registrar:major_authority', issues);
  exactTextCount(contentNodes, EXPECTED.registrar.major_disputes, 'registrar:major_disputes', issues);

  const agreementHeading = $('h3').filter((index, element) => (
    normalize($(element).text()) === EXPECTED.registrar.agreement_heading
  ));
  if (agreementHeading.length !== 1) issues.push('registrar:agreement_heading');
  const links = agreementHeading.first().next('ul').find('a').filter((index, element) => (
    normalize($(element).text()) === normalize(EXPECTED.registrar.agreement_link)
      && new URL($(element).attr('href'), REGISTRAR_URL).href === GAA_URL
  ));
  if (links.length !== 1) issues.push('registrar:current_gaa_link');

  return {
    title: normalize($('title').text()),
    heading: $('h1').length === 1 ? normalize($('h1').text()) : null,
    current_gaa_link_count: links.length,
  };
}

function parseGaaText(gaaText, issues) {
  const source = normalize(gaaText);
  for (const [key, expected] of Object.entries(EXPECTED.gaa)) {
    if (key === 'signatures') continue;
    const needle = normalize(expected);
    if (source.split(needle).length - 1 !== 1) issues.push(`gaa:${key}`);
  }
  for (const signature of EXPECTED.gaa.signatures) {
    if (!source.includes(signature)) issues.push(`gaa:signature:${signature}`);
  }
}

function loose(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseSenderAwardEvidence(senderSources, issues) {
  return VCCS_SENDER_RECEIPTS.map((receipt) => {
    const source = senderSources?.[receipt.numeric_id] || {};
    const vccsHtml = String(source.vccsHtml || '');
    const schevHtml = String(source.schevHtml || '');
    const vccs = cheerio.load(vccsHtml);
    const schev = cheerio.load(schevHtml);
    const expectedMajorHref = `/colleges/${receipt.vccs_slug}/programs/major/${receipt.vccs_major_path}`;
    const matchingMajor = vccs('a').filter((index, element) => (
      vccs(element).attr('href') === expectedMajorHref
      && normalize(vccs(element).text()) === receipt.vccs_degree_title
    ));
    const vccsTitle = normalize(vccs('title').text());
    if (matchingMajor.length !== 1
        || !vccsHtml.includes(`<!-- ${receipt.cip_code} -->`)
        || !loose(vccsTitle).includes(loose(receipt.cip_code === '11.0701'
          ? 'Computer Science' : 'Biological and Physical Sciences'))) {
      issues.push(`sender:${receipt.numeric_id}:vccs_award_identity`);
    }

    const schevTitle = normalize(schev('title').text());
    const schevText = normalize(schev('body').text());
    if (!loose(schevTitle).includes(loose(receipt.schev_program_name))
        || !loose(schevTitle).includes(loose(receipt.name))
        || !schevText.includes("Associate's Degree - Transfer")) {
      issues.push(`sender:${receipt.numeric_id}:schev_transfer_classification`);
    }
    return {
      numeric_id: receipt.numeric_id,
      source_id: receipt.source_id,
      award: 'AS',
      cip_code: receipt.cip_code,
      vccs: {
        requested_url: receipt.vccs_program_url,
        final_url: source.vccsFinalUrl || receipt.vccs_program_url,
        content_type: source.vccsContentType || 'text/html; charset=UTF-8',
        response_bytes: Buffer.byteLength(vccsHtml),
        response_sha256: sha256(vccsHtml),
        degree_title: receipt.vccs_degree_title,
        degree_href: expectedMajorHref,
      },
      schev: {
        requested_url: receipt.schev_program_url,
        final_url: source.schevFinalUrl || receipt.schev_program_url,
        content_type: source.schevContentType || 'text/html; charset=utf-8',
        response_bytes: Buffer.byteLength(schevHtml),
        response_sha256: sha256(schevHtml),
        program_name: receipt.schev_program_name,
        classification: "Associate's Degree - Transfer",
      },
      conclusion:
        'The exact current VCCS A.S. award is listed by CIP on the official VCCS program page and the same institution/CIP is classified by SCHEV as an Associate\'s Degree - Transfer.',
    };
  });
}

function policyFacts() {
  return {
    current_policy_bridge: {
      current_registrar_page_links_exact_signed_agreement: true,
      agreement_remains_until_modified_or_terminated: true,
      agreement_effective_date: '2023-06-14',
      current_fixed_catalog: CATALOG_YEAR,
      inference:
        'The current registrar page still publishes the exact signed agreement whose duration clause keeps it effective until modification or termination.',
    },
    agreement_scope: {
      parties: ['UVA Wise', 'VCCS'],
      source_systems: ['VCCS'],
      richard_bland_is_party: false,
      qualifying_awards: ['AA', 'AS', 'AA&S'],
      schev_transfer_degree_required: true,
      general_studies_requires_schev_transfer_designation: true,
      minimum_cumulative_gpa: 2.5,
      minimum_associate_units: 60,
      minimum_units_at_degree_granting_institution: 30,
      passing_grade_above: 'D',
      gap_application_required: true,
      transfer_virginia_intent_registration_required: false,
    },
    credit_application: {
      all_transfer_degree_credits_accepted: true,
      accepted_credit_ceiling_units: 62,
      lower_division_general_education_met: true,
      guaranteed_units_applied_to_degree_minimum: 60,
      bachelor_degree_minimum_units: 120,
      chosen_major_requirements_still_apply: true,
    },
    registrar_scope: {
      admission_sentence_includes_vccs_and_richard_bland: true,
      ge_waiver_sentence_is_public_virginia_community_college_only: true,
      ge_waiver_requires_gap_participation: true,
      richard_bland_ge_waiver_published: false,
      academic_departments_retain_major_credit_application_authority: true,
    },
  };
}

function parseUvaWiseTransferPolicyEvidence({
  registrarHtml = '',
  gaaPdf = Buffer.alloc(0),
  gaaText = '',
  robotsText = '',
  responses = {},
  robotsStatus = 200,
  senderSources = {},
} = {}) {
  const issues = [];
  const expectedResponses = {
    registrar: {
      requestedUrl: REGISTRAR_URL, finalUrl: REGISTRAR_URL,
      contentType: 'text/html; charset=UTF-8',
      ...(responses.registrar || {}),
    },
    gaa: {
      requestedUrl: GAA_URL, finalUrl: GAA_URL,
      contentType: 'application/pdf',
      ...(responses.gaa || {}),
    },
  };
  const registrar = parseRegistrar(registrarHtml, issues);
  parseGaaText(gaaText, issues);
  const senderAwardEvidence = parseSenderAwardEvidence(senderSources, issues);
  const pdf = Buffer.isBuffer(gaaPdf) ? gaaPdf : Buffer.from(gaaPdf || '');
  if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) issues.push('gaa:pdf_signature');
  for (const [key, url] of [['registrar', REGISTRAR_URL], ['gaa', GAA_URL]]) {
    const response = expectedResponses[key];
    if (response.requestedUrl !== url || response.finalUrl !== url) issues.push(`${key}:source_url`);
    const expectedType = key === 'registrar' ? 'text/html' : 'application/pdf';
    if (!String(response.contentType || '').toLowerCase().includes(expectedType)) {
      issues.push(`${key}:content_type`);
    }
    if (!robotsAllows(url, robotsText)) issues.push(`${key}:robots_policy`);
  }
  if (robotsStatus !== 200 || !String(robotsText || '').trim()) issues.push('robots:response');

  const facts = policyFacts();
  return {
    verified: issues.length === 0,
    issues,
    sources: {
      current_registrar_page: {
        requested_url: expectedResponses.registrar.requestedUrl,
        final_url: expectedResponses.registrar.finalUrl,
        content_type: expectedResponses.registrar.contentType,
        response_bytes: Buffer.byteLength(String(registrarHtml || '')),
        response_sha256: sha256(String(registrarHtml || '')),
        ...registrar,
      },
      signed_vccs_gaa: {
        requested_url: expectedResponses.gaa.requestedUrl,
        final_url: expectedResponses.gaa.finalUrl,
        content_type: expectedResponses.gaa.contentType,
        response_bytes: pdf.length,
        response_sha256: sha256(pdf),
        extracted_text_bytes: Buffer.byteLength(String(gaaText || '')),
        extracted_text_sha256: sha256(String(gaaText || '')),
        document_revision: 'GAA Updated 3.23.23',
        signed_dates: [...EXPECTED.gaa.signatures],
        effective_date: '2023-06-14',
      },
    },
    robots: {
      url: ROBOTS_URL,
      http_status: robotsStatus,
      response_bytes: Buffer.byteLength(String(robotsText || '')),
      response_sha256: sha256(String(robotsText || '')),
      policy_paths_allowed: [REGISTRAR_URL, GAA_URL]
        .every((url) => robotsAllows(url, robotsText)),
    },
    policy_facts: facts,
    policy_facts_sha256: semanticSha256(facts),
    sender_award_evidence: senderAwardEvidence,
    sender_award_evidence_sha256: semanticSha256(senderAwardEvidence),
  };
}

function buildUvaWiseTransferPolicyEvidence(input = {}) {
  const parsed = parseUvaWiseTransferPolicyEvidence(input);
  if (!parsed.verified) {
    throw new Error(`UVA Wise transfer-policy source did not verify: ${parsed.issues.join(', ')}`);
  }
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    generated_on: '2026-08-25',
    institution: {
      name: "The University of Virginia's College at Wise",
      slug: 'the-university-of-virginia-s-college-at-wise',
      school_id: 9226,
    },
    catalog_year: CATALOG_YEAR,
    purpose:
      "Exact supplemental policy receipt for the paper's successful, qualifying VCCS transfer-oriented A.S. cohort. It does not alter the reviewed Computer Science tree, waive any major requirement, cover Richard Bland, or import a 2025-2026 transfer guide into 2026-2027.",
    ...parsed,
    sender_receipts: VCCS_SENDER_RECEIPTS.map((row) => ({ ...row })),
    publication_boundary: {
      authoritative_source_collection: 'va_requirements',
      protected_projection_receipts: 18,
      candidate_tuples_matching_protected_projection: 6,
      candidate_tuples_different_from_protected_projection: 12,
      build_va_documents_apply_updates_source_collection: false,
      both_protected_and_candidate_tuples_bound_independently: true,
    },
    paper_interpretation: {
      incoming_award: 'AS',
      scenario_id: 'successful_gaa_participant',
      successful_gaa_conditions_required: true,
      ordinary_non_gap_transfer_receives_waiver: false,
      optional_policy_failure_blocks_ordinary_route: false,
      lower_division_ge_groups_superseded: [6, 7, 8, 9, 10, 11, 12],
      contextual_rule_group: 12,
      contextual_rule_kinds: [
        'contextual_subarea_minimums',
        'contextual_disciplinary_breadth',
        'inclusive_excellence_designation',
        'no_core_cross_area_double_count',
      ],
      minimum_units_applied_to_120: 60,
      maximum_degree_credits_accepted: 62,
      major_specific_two_lab_sciences_waived: false,
      richard_bland_covered: false,
      qualifying_vccs_sender_count: 18,
      transfer_guide_2025_2026_used_as_2026_2027_bridge: false,
      bachelor_source_constraints_cleared_without_pair_context: false,
      figure_3_4_policy_rules_exact_only_in_selected_successful_gaa_scenario: true,
      figure_3_4_cells_made_ready_without_lab_science_proof: 0,
    },
  };
}

function uvaWiseTransferPolicyEvidenceIssue(evidence) {
  const facts = evidence?.policy_facts;
  const paper = evidence?.paper_interpretation;
  const boundary = evidence?.publication_boundary;
  const sources = evidence?.sources || {};
  if (evidence?.schema_version !== 1 || evidence?.artifact !== ARTIFACT
      || evidence?.catalog_year !== CATALOG_YEAR || evidence?.verified !== true
      || (evidence?.issues || []).length !== 0
      || evidence?.institution?.slug !== 'the-university-of-virginia-s-college-at-wise'
      || evidence?.institution?.school_id !== 9226
      || semanticSha256(facts) !== evidence?.policy_facts_sha256
      || sources.current_registrar_page?.response_bytes !== RESPONSE_BYTES.registrar
      || sources.current_registrar_page?.response_sha256 !== RESPONSE_SHA256.registrar
      || sources.current_registrar_page?.requested_url !== REGISTRAR_URL
      || sources.current_registrar_page?.final_url !== REGISTRAR_URL
      || sources.current_registrar_page?.current_gaa_link_count !== 1
      || sources.signed_vccs_gaa?.response_bytes !== RESPONSE_BYTES.gaa_pdf
      || sources.signed_vccs_gaa?.response_sha256 !== RESPONSE_SHA256.gaa_pdf
      || sources.signed_vccs_gaa?.extracted_text_bytes !== RESPONSE_BYTES.gaa_text
      || sources.signed_vccs_gaa?.extracted_text_sha256 !== RESPONSE_SHA256.gaa_text
      || sources.signed_vccs_gaa?.requested_url !== GAA_URL
      || sources.signed_vccs_gaa?.final_url !== GAA_URL
      || evidence?.robots?.response_bytes !== RESPONSE_BYTES.robots
      || evidence?.robots?.response_sha256 !== RESPONSE_SHA256.robots
      || evidence?.robots?.policy_paths_allowed !== true) {
    return 'the exact current UVA Wise registrar/GAA source receipt changed';
  }
  if (facts?.current_policy_bridge?.current_registrar_page_links_exact_signed_agreement !== true
      || facts?.current_policy_bridge?.agreement_remains_until_modified_or_terminated !== true
      || facts?.current_policy_bridge?.current_fixed_catalog !== CATALOG_YEAR
      || JSON.stringify(facts?.agreement_scope?.source_systems) !== JSON.stringify(['VCCS'])
      || facts?.agreement_scope?.richard_bland_is_party !== false
      || JSON.stringify(facts?.agreement_scope?.qualifying_awards)
        !== JSON.stringify(['AA', 'AS', 'AA&S'])
      || facts?.agreement_scope?.minimum_cumulative_gpa !== 2.5
      || facts?.credit_application?.accepted_credit_ceiling_units !== 62
      || facts?.credit_application?.lower_division_general_education_met !== true
      || facts?.credit_application?.guaranteed_units_applied_to_degree_minimum !== 60
      || facts?.credit_application?.bachelor_degree_minimum_units !== 120
      || facts?.credit_application?.chosen_major_requirements_still_apply !== true
      || facts?.registrar_scope?.ge_waiver_sentence_is_public_virginia_community_college_only !== true
      || facts?.registrar_scope?.richard_bland_ge_waiver_published !== false
      || facts?.registrar_scope?.academic_departments_retain_major_credit_application_authority !== true
      || paper?.incoming_award !== 'AS'
      || paper?.scenario_id !== 'successful_gaa_participant'
      || paper?.successful_gaa_conditions_required !== true
      || paper?.ordinary_non_gap_transfer_receives_waiver !== false
      || paper?.optional_policy_failure_blocks_ordinary_route !== false
      || JSON.stringify(paper?.lower_division_ge_groups_superseded)
        !== JSON.stringify([6, 7, 8, 9, 10, 11, 12])
      || paper?.major_specific_two_lab_sciences_waived !== false
      || paper?.richard_bland_covered !== false
      || paper?.qualifying_vccs_sender_count !== 18
      || paper?.transfer_guide_2025_2026_used_as_2026_2027_bridge !== false
      || paper?.bachelor_source_constraints_cleared_without_pair_context !== false
      || paper?.figure_3_4_policy_rules_exact_only_in_selected_successful_gaa_scenario !== true
      || paper?.figure_3_4_cells_made_ready_without_lab_science_proof !== 0) {
    return 'the UVA Wise policy semantics no longer support the bounded VCCS A.S. interpretation';
  }
  if (boundary?.authoritative_source_collection !== 'va_requirements'
      || boundary?.protected_projection_receipts !== 18
      || boundary?.candidate_tuples_matching_protected_projection !== 6
      || boundary?.candidate_tuples_different_from_protected_projection !== 12
      || boundary?.build_va_documents_apply_updates_source_collection !== false
      || boundary?.both_protected_and_candidate_tuples_bound_independently !== true) {
    return 'the UVA Wise sender publication boundary changed';
  }
  if (JSON.stringify(evidence?.sender_receipts)
      !== JSON.stringify(VCCS_SENDER_RECEIPTS.map((row) => ({ ...row })))) {
    return 'the exact 18-member VCCS sender receipt changed';
  }
  if (!Array.isArray(evidence?.sender_award_evidence)
      || evidence.sender_award_evidence.length !== VCCS_SENDER_RECEIPTS.length
      || semanticSha256(evidence.sender_award_evidence)
        !== evidence?.sender_award_evidence_sha256
      || evidence.sender_award_evidence.some((row, index) => {
        const receipt = VCCS_SENDER_RECEIPTS[index];
        return row?.numeric_id !== receipt.numeric_id
          || row?.source_id !== receipt.source_id
          || row?.award !== 'AS'
          || row?.cip_code !== receipt.cip_code
          || row?.vccs?.requested_url !== receipt.vccs_program_url
          || row?.vccs?.final_url !== receipt.vccs_program_url
          || row?.vccs?.degree_title !== receipt.vccs_degree_title
          || row?.vccs?.response_bytes <= 0
          || !/^[a-f0-9]{64}$/.test(row?.vccs?.response_sha256 || '')
          || row?.schev?.requested_url !== receipt.schev_program_url
          || row?.schev?.final_url !== receipt.schev_program_url
          || row?.schev?.program_name !== receipt.schev_program_name
          || row?.schev?.classification !== "Associate's Degree - Transfer"
          || row?.schev?.response_bytes <= 0
          || !/^[a-f0-9]{64}$/.test(row?.schev?.response_sha256 || '');
      })) {
    return 'the exact per-sender VCCS/SCHEV transfer-award evidence changed';
  }
  return null;
}

module.exports = {
  ARTIFACT,
  CATALOG_YEAR,
  EXPECTED,
  GAA_URL,
  REGISTRAR_URL,
  RESPONSE_BYTES,
  RESPONSE_SHA256,
  ROBOTS_URL,
  USER_AGENT,
  VCCS_SENDER_RECEIPTS,
  buildUvaWiseTransferPolicyEvidence,
  normalize,
  normalizedUvaWiseVccsSenderTree,
  parseUvaWiseTransferPolicyEvidence,
  robotsAllows,
  semanticSha256,
  sha256,
  uvaWiseTransferPolicyEvidenceIssue,
  uvaWiseVccsSenderTreeFingerprint,
};
