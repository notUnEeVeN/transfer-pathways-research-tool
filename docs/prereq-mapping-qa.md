# Course-concept mapping — QA report (G4)

**Artifact:** `scripts/data/course_concepts.json` · 4730 rows · 4,460 mapped, 270 examined-null.
**Vote agreement:** 4,627 unanimous (97.8%) · 32 settled 2-of-3 · 4 no-majority · 67 needs_review (tiebreak cut short by token limit — deliberately not re-run; fix in console).

## Your review queue (all fixable in Data → Prerequisites → Mapping)

1. **71 unresolved rows** (`needs_review`/`no_majority`, concept null, confidence 0) — filter Mapping by 'unmapped only'; they sit alongside genuinely-null courses but carry flags in the artifact.
2. **122 legacy disagreements** (of 177 comparable courses; 55 match the old group's edges exactly) — table below; ours-right vs theirs-right is your call, edit the mapping where theirs is right.
3. **88 combined courses** (mapped to deepest constituent per the locked convention) — spot-check a few.
4. **Random-sample check:** eyeball any slice of the Mapping table; when satisfied, tell me an approximate error rate (or "fine") and I record it in the artifact meta.

## Legacy disagreements

| college | course | legacy edges | projected edges |
|---|---|---|---|
| cc:41 | MATH 5B | — | cc:309251 |
| cc:41 | MATH 5C | — | cc:253370 |
| cc:41 | MATH 6 | — | cc:309249 |
| cc:41 | MATH 7 | — | cc:199717 |
| cc:41 | MATH 23 | — | cc:309251 |
| cc:41 | CS 20P | — | cc:247553, cc:270088, cc:293233, cc:300378, cc:377685 |
| cc:41 | CS 20J | — | cc:247553, cc:270088, cc:293233, cc:300378, cc:377685 |
| cc:41 | CS 19 | — | cc:247553, cc:270088, cc:293233, cc:300378, cc:377685 |
| cc:41 | CS 21 | — | cc:284583, cc:297157, cc:375469 |
| cc:41 | CS 23 | — | cc:309251 |
| cc:41 | CS 24 | — | cc:247553, cc:270088, cc:293233, cc:300378, cc:377685 |
| cc:96 | MTH 2 | — | cc:308111 |
| cc:96 | MTH 3 | — | cc:307819 |
| cc:96 | MTH 4 | — | cc:340160 |
| cc:96 | MTH 6 | — | cc:302906 |
| cc:96 | MTH 8 | — | cc:308111 |
| cc:96 | MTH 16 | — | cc:220778 |
| cc:96 | CSCI 15 | — | cc:284395 |
| cc:96 | CSCI 20 | — | cc:281755, cc:293219 |
| cc:96 | CSCI 21 | — | cc:284395 |
| cc:96 | CSCI 28 | — | cc:308111 |
| cc:96 | CSCI 19A | — | cc:284395 |
| cc:33 | MATH 110B | — | cc:281199 |
| cc:33 | MATH 110C | — | cc:253725 |
| cc:33 | MATH 115 | — | cc:281199 |
| cc:33 | MATH 120 | — | cc:288548 |
| cc:33 | MATH 125 | — | cc:161238 |
| cc:33 | MATH 130 | — | cc:161238 |
| cc:33 | CS 110B | — | cc:172642, cc:229246, cc:233682 |
| cc:33 | CS 110C | — | cc:208809 |
| cc:33 | CS 111C | — | cc:208809 |
| cc:33 | CS 270 | — | cc:172642, cc:229246, cc:233682 |
| cc:142 | MATH 400 | cc:385122, cc:385123 | — |
| cc:142 | MATH 410 | cc:354209 | cc:257070 |
| cc:142 | MATH 420 | cc:354209 | cc:189329 |
| cc:142 | CISP 360 | cc:120132 | — |
| cc:142 | CISP 430 | — | cc:268914, cc:294983 |
| cc:142 | CISP 440 | — | cc:284892 |
| cc:113 | MATH 1D | cc:309559, cc:359110 | cc:288769, cc:307949 |
| cc:113 | MATH 1DH | cc:309559, cc:359110 | cc:288769, cc:307949 |
| cc:113 | MATH 2A | cc:302624, cc:309560 | cc:302590, cc:363589 |
| cc:113 | MATH 2AH | cc:302624, cc:309560 | cc:302590, cc:363589 |
| cc:113 | MATH 2B | cc:302624, cc:309560 | cc:302624, cc:309559, cc:309560, cc:359110 |
| cc:113 | MATH 2BH | cc:302624, cc:309560 | cc:302624, cc:309559, cc:309560, cc:359110 |
| cc:113 | MATH 22 | — | cc:281397, cc:288768 |
| cc:113 | MATH 22H | — | cc:281397, cc:288768 |
| cc:113 | CIS 22B | cc:275613 | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 22BH | cc:275613 | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 22C | cc:300758, cc:300769 | cc:275644, cc:279908, cc:300749, cc:300758, cc:300769 |
| cc:113 | CIS 22CH | cc:300758, cc:300769 | cc:275644, cc:279908, cc:300749, cc:300758, cc:300769 |
| cc:113 | CIS 26A | — | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 26B | — | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 26BH | — | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 27 | — | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 36B | cc:300746 | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 41B | cc:306398 | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 21JA | — | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:113 | CIS 21JB | cc:279901 | cc:275526, cc:275613, cc:300746, cc:306397, cc:306398 |
| cc:145 | MATH 401 | — | cc:359653 |
| cc:145 | MATH 402 | — | cc:304014 |
| cc:145 | MATH 410 | — | cc:304012 |
| cc:145 | MATH 420 | — | cc:247241 |
| cc:145 | CISP 401 | — | cc:268900, cc:361023 |
| cc:145 | CISP 310 | — | cc:268900, cc:361023 |
| cc:145 | CISP 430 | — | cc:268901, cc:270020 |
| cc:145 | CISP 440 | — | cc:359653 |
| cc:51 | MATH 1B | — | cc:305211, cc:359157 |
| cc:51 | MATH 1C | — | cc:280536, cc:362986 |
| cc:51 | MATH 1D | — | cc:280536, cc:362986 |
| cc:51 | MATH 2A | — | cc:302742 |
| cc:51 | MATH 2B | — | cc:307930, cc:308228 |
| cc:51 | MATH 22 | — | cc:305211, cc:359157 |
| cc:51 | CS 10 | — | cc:287030, cc:308492, cc:309477 |
| cc:51 | CS 18 | — | cc:305211, cc:359157 |
| cc:51 | CS 1B | — | cc:287030, cc:308492, cc:309477 |
| cc:51 | CS 1C | — | cc:303399, cc:308494, cc:309584 |
| cc:51 | CS 2B | — | cc:287030, cc:308492, cc:309477 |
| cc:51 | CS 3B | — | cc:287030, cc:308492, cc:309477 |
| cc:18 | MATH 2 | — | cc:358933 |
| cc:18 | MATH 3 | — | cc:307786 |
| cc:18 | MATH 5 | — | cc:144731 |
| cc:18 | MATH 7 | — | cc:307900 |
| cc:18 | MATH 10 | — | cc:358933 |
| cc:18 | CS 2 | — | cc:209894, cc:271433, cc:294821 |
| cc:18 | CS 17 | — | cc:358933 |
| cc:18 | CS 20 | — | cc:271424 |
| cc:18 | CS 21 | — | cc:209894, cc:271433, cc:294821 |
| cc:108 | MATH 155 | — | cc:307874, cc:359956, cc:387657 |
| cc:108 | MATH 260 | — | cc:353693 |
| cc:108 | MATH 270 | — | cc:353261 |
| cc:108 | MATH 265 | — | cc:154847 |
| cc:108 | MATH 226 | — | cc:307874, cc:359956, cc:387657 |
| cc:108 | CS 112 | — | cc:204642, cc:219917, cc:246548 |
| cc:108 | CS 113 | — | cc:204781, cc:221127, cc:384839 |
| cc:53 | MATH-212 | — | cc:302770, cc:376300 |
| cc:53 | MATH-213 | — | cc:308085, cc:308517 |
| cc:53 | MATH-215 | — | cc:299035 |
| cc:53 | MATH-218 | — | cc:280563, cc:303844 |
| cc:53 | CSIS-123A | — | cc:193898, cc:223439, cc:252926 |
| cc:53 | CSIS-211 | — | cc:193503, cc:226879, cc:244211 |
| cc:53 | CSIS-213 | — | cc:302770, cc:376300 |
| cc:53 | CSIS-118B | — | cc:193898, cc:223439, cc:252926 |
| cc:74 | MATH A182H | — | cc:283782, cc:356161 |
| cc:74 | MATH A185 | — | cc:283782, cc:356161 |
| cc:74 | MATH A185H | — | cc:283782, cc:356161 |
| cc:74 | MATH A280 | — | cc:279814, cc:297734, cc:356158 |
| cc:74 | MATH A235 | — | cc:279344, cc:289849 |
| cc:74 | CS A262 | — | cc:283782, cc:356161 |
| cc:74 | CS A263 | — | cc:279814, cc:297734, cc:356158 |
| cc:74 | CS A200 | — | cc:270444, cc:361768 |
| cc:74 | CS A216 | — | cc:257582, cc:270386, cc:294142, cc:299383 |
| cc:137 | MATH 7 | cc:308231 | — |
| cc:137 | MATH 13 | cc:303081 | cc:358846 |
| cc:137 | MATH 15 | cc:303081 | cc:156086 |
| cc:137 | MATH 10 | cc:303081 | cc:308210 |
| cc:137 | CS 20A | cc:210517 | cc:235965, cc:376516 |
| cc:137 | CS 20B | cc:235965 | cc:235965, cc:376516 |
| cc:137 | CS 17 | — | cc:210517, cc:214590, cc:349285 |
| cc:137 | CS 18 | cc:197324, cc:210517 | — |
| cc:137 | CS 50 | — | cc:210517, cc:214590, cc:349285 |
| cc:137 | CS 56 | cc:214590 | cc:210517, cc:214590, cc:349285 |
| cc:137 | CS 87B | — | cc:210517, cc:214590, cc:349285 |

## Unresolved rows

| course | college | title |
|---|---|---|
| cc:4336 | cc:114 | Calculus Supplement for Physics 120 |
| cc:36335 | cc:54 | General Physics Laboratory - I |
| cc:36370 | cc:54 | General Physics Laboratory - II |
| cc:55165 | cc:114 | Calculus Supplement for Physics 121 |
| cc:57196 | cc:45 | General Physics Laboratory II |
| cc:57591 | cc:45 | General Physics Laboratory I |
| cc:61557 | cc:93 | Principles of Physics Laboratory: Electricity and Magnetism |
| cc:61935 | cc:66 | Introductory Physics I-Calculus |
| cc:62394 | cc:93 | Principles of Physics Laboratory: Mechanics |
| cc:139949 | cc:121 | Critical Thinking |
| cc:153085 | cc:32 | Introduction to C Programming |
| cc:156456 | cc:70 | Critical Thinking and Argumentation |
| cc:166906 | cc:93 | Introduction to Critical Thinking |
| cc:167125 | cc:17 | Critical Thinking |
| cc:167832 | cc:104 | Philosophical Reasoning: Critical Thinking in Philosophy |
| cc:167910 | cc:49 | Introduction to Critical Thinking |
| cc:174068 | cc:47 | Programming in Visual Basic |
| cc:174757 | cc:19 | Introduction to Critical Thinking |
| cc:179244 | cc:25 | Programming in C# |
| cc:197054 | cc:68 | Introduction to Computer Science |
| cc:197292 | cc:110 | Critical Thinking |
| cc:198441 | cc:3 | Programming Logic and Design (Introduction to Programming) |
| cc:201147 | cc:56 | Critical Thinking |
| cc:203806 | cc:133 | Introduction to Critical Thinking |
| cc:205417 | cc:44 | Programming in C# |
| cc:208836 | cc:94 | Critical Thinking: The Philosophic Grounds of Literacy |
| cc:209726 | cc:64 | Critical Thinking |
| cc:213280 | cc:130 | Programming in Visual Basic |
| cc:213982 | cc:137 | Visual BASIC Programming |
| cc:226018 | cc:130 | Introduction to Computer Science |
| cc:238249 | cc:64 | Critical Thinking Honors |
| cc:246013 | cc:19 | Composition and Literature |
| cc:253182 | cc:43 | Introduction to Algorithms |
| cc:253427 | cc:52 | Mechanics, Heat, & Waves |
| cc:255947 | cc:131 | Introduction to Visual BASIC.NET |
| cc:262421 | cc:62 | Engineering Critical Thinking |
| cc:271842 | cc:92 | Introductory Physics |
| cc:273645 | cc:41 | Introduction to C/C++ Programming Using Microcontrollers |
| cc:273933 | cc:121 | General Physics |
| cc:280473 | cc:113 | Argumentation: Analysis of Oral and Written Communication |
| cc:281469 | cc:28 | General Physics III |
| cc:284955 | cc:56 | Fundamentals of Physics |
| cc:286633 | cc:66 | Critical Thinking |
| cc:287803 | cc:52 | Electricity, Magnetism, Optics, Atomic and Nuclear Structure |
| cc:288995 | cc:14 | Critical Thinking |
| cc:295217 | cc:38 | Introduction to Computer Science |
| cc:301630 | cc:66 | Honors Critical Thinking |
| cc:303267 | cc:92 | Introductory Physics |
| cc:303789 | cc:56 | Fundamentals of Physics |
| cc:303979 | cc:126 | Honors College Composition and Research |
| cc:304408 | cc:121 | General Physics |
| cc:316580 | cc:93 | Principles of Physics Laboratory: Heat, Waves and Modern Phy |
| cc:316627 | cc:66 | Introductory Physics II-Calculus |
| cc:338261 | cc:6 | Critical Thinking |
| cc:350642 | cc:114 | Critical Thinking in Visual Studies |
| cc:353044 | cc:101 | General Biology - Lecture and Laboratory |
| cc:356211 | cc:99 | Intermediate Java Programming and Fundamental Data Structure |
| cc:356356 | cc:99 | Intermediate C++ Programming and Fundamental Data Structures |
| cc:356664 | cc:14 | Honors Critical Thinking |
| cc:363590 | cc:113 | Argumentation: Analysis of Oral and Written Communication -  |
| cc:363970 | cc:49 | Honors Critical Thinking  |
| cc:364462 | cc:138 | Fundamentals of Physics I |
| cc:364463 | cc:138 | Fundamentals of Physics Laboratory I |
| cc:364464 | cc:138 | Fundamentals of Physics II |
| cc:364465 | cc:138 | Fundamentals of Physics Laboratory II |
| cc:369849 | cc:20 | Critical Thinking |
| cc:370079 | cc:28 | Advanced Programming with C and C++ |
| cc:371861 | cc:153 | Optics and Modern Physics |
| cc:372556 | cc:101 | General Physics Laboratory I |
| cc:372557 | cc:101 | General Physics Laboratory II |
| cc:375159 | cc:5 | Applied Python Programming |
