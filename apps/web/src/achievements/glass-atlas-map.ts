export type GlassAtlasRegion = {
  src: string;
  atlasWidth: number;
  atlasHeight: number;
  crop: readonly [number, number, number, number];
  /** Native atlas y coordinate of the ivory pedestal's physical lower edge. */
  baseline: number;
  stage: number;
};

export const glassAchievementAtlas: Record<string, GlassAtlasRegion> = {
  first_task: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [43, 75, 118, 148], baseline: 221, stage: 1 },
  warmup: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [230, 69, 130, 154], baseline: 221, stage: 2 },
  working_set: { src: "/achievements/glass/stage-three-atlas-v1.png", atlasWidth: 1774, atlasHeight: 887, crop: [101, 118, 683, 684], baseline: 800, stage: 3 },
  fifty: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [610, 61, 168, 162], baseline: 221, stage: 4 },
  three_digits: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [802, 53, 180, 170], baseline: 221, stage: 5 },
  data_stream: { src: "/achievements/glass/stage-six-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [135, 121, 1015, 1016], baseline: 1135, stage: 6 },
  compute_module: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [1196, 43, 186, 180], baseline: 221, stage: 7 },
  thousand: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [1394, 34, 182, 189], baseline: 221, stage: 8 },
  first_module: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [33, 282, 138, 131], baseline: 412, stage: 1 },
  three_modules: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [211, 272, 178, 141], baseline: 412, stage: 2 },
  half_system: { src: "/achievements/glass/stage-three-atlas-v1.png", atlasWidth: 1774, atlasHeight: 887, crop: [909, 201, 835, 601], baseline: 800, stage: 3 },
  full_assembly: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [594, 270, 195, 143], baseline: 412, stage: 4 },
  no_empty_cell: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [795, 260, 196, 153], baseline: 412, stage: 5 },
  absolute_coverage: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [994, 243, 195, 170], baseline: 412, stage: 6 },
  error_intercept: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [39, 447, 122, 154], baseline: 600, stage: 1 },
  error_work: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [224, 442, 147, 159], baseline: 600, stage: 2 },
  debugger: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [410, 432, 182, 169], baseline: 600, stage: 3 },
  first_execution: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [39, 620, 122, 168], baseline: 787, stage: 1 },
  sandbox_researcher: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [235, 619, 126, 169], baseline: 787, stage: 2 },
  laboratory: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [420, 617, 159, 171], baseline: 787, stage: 3 },
  own_data: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [39, 813, 122, 150], baseline: 962, stage: 1 },
  first_dataframe: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [237, 808, 122, 155], baseline: 962, stage: 2 },
  multiple_sources: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [435, 805, 125, 158], baseline: 962, stage: 3 },
  independent_project: { src: "/achievements/glass/practice-atlas-v1.png", atlasWidth: 1586, atlasHeight: 992, crop: [614, 804, 163, 159], baseline: 962, stage: 4 },
  comeback_2d: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [65, 85, 154, 194], baseline: 278, stage: 1 },
  comeback_7d: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [287, 65, 192, 214], baseline: 278, stage: 2 },
  comeback_30d: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [546, 65, 168, 214], baseline: 278, stage: 3 },
  comeback_90d: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [766, 62, 223, 217], baseline: 278, stage: 4 },
  rhythm_3_7: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [36, 360, 210, 143], baseline: 501, stage: 1 },
  rhythm_10_30: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [268, 355, 233, 148], baseline: 501, stage: 2 },
  rhythm_25_90: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [517, 331, 246, 172], baseline: 501, stage: 3 },
  panorama_3: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [60, 548, 161, 188], baseline: 735, stage: 1 },
  panorama_7: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [306, 546, 163, 190], baseline: 735, stage: 2 },
  panorama_12: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [540, 546, 197, 191], baseline: 735, stage: 3 },
  first_mini_analysis: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [39, 772, 240, 208], baseline: 978, stage: 1 },
  study_first_immersion: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [63, 1024, 157, 186], baseline: 1209, stage: 1 },
  study_found_rhythm: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [273, 1023, 190, 187], baseline: 1209, stage: 2 },
  study_engaged_practice: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [476, 1022, 271, 188], baseline: 1209, stage: 3 },
  study_attentive_research: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [751, 1020, 245, 190], baseline: 1209, stage: 4 },
  study_long_journey: { src: "/achievements/glass/rhythm-atlas-v1.png", atlasWidth: 1254, atlasHeight: 1254, crop: [997, 1003, 242, 207], baseline: 1209, stage: 5 },
};
