export const MUSCLE_GROUPS = [
  {
    id: 'arms',
    label: 'Arms',
    muscles: [
      { id: 'biceps', label: 'Biceps', aliases: ['biceps'] },
      { id: 'triceps', label: 'Triceps', aliases: ['triceps'] },
      { id: 'forearms', label: 'Forearms', aliases: ['forearms', 'forearm'] },
    ],
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    muscles: [
      { id: 'deltoids', label: 'Deltoids', aliases: ['deltoids', 'shoulders', 'front delts', 'rear delts'] },
      { id: 'rotator_cuff', label: 'Rotator Cuff', aliases: ['rotator cuff'] },
    ],
  },
  {
    id: 'chest',
    label: 'Chest',
    muscles: [
      { id: 'pectorals', label: 'Pectorals', aliases: ['pectorals', 'chest', 'upper chest'] },
    ],
  },
  {
    id: 'back',
    label: 'Back',
    muscles: [
      { id: 'upper_back', label: 'Upper Back', aliases: ['upper back', 'lats', 'rhomboids'] },
      { id: 'trapezius', label: 'Trapezius', aliases: ['trapezius', 'traps'] },
      { id: 'paravertebrals', label: 'Paravertebrals', aliases: ['paravertebrals', 'spinal erectors'] },
    ],
  },
  {
    id: 'core',
    label: 'Core',
    muscles: [
      { id: 'abdominals', label: 'Abdominals', aliases: ['abdominals', 'abs', 'rectus abdominis'] },
      { id: 'lower_back', label: 'Lower Back', aliases: ['lower back'] },
      { id: 'oblique', label: 'Oblique', aliases: ['oblique', 'obliques'] },
      { id: 'transverse_abdominis', label: 'Transverse Abdominis', aliases: ['transverse abdominis'] },
      { id: 'diaphragm', label: 'Diaphragm', aliases: ['diaphragm'] },
    ],
  },
  {
    id: 'hips_legs',
    label: 'Hips / Legs',
    muscles: [
      { id: 'adductors', label: 'Adductors', aliases: ['adductors'] },
      { id: 'gluteus', label: 'Gluteus', aliases: ['gluteus', 'glutes'] },
      { id: 'hamstrings', label: 'Hamstrings', aliases: ['hamstrings'] },
      { id: 'calves', label: 'Calves', aliases: ['calves', 'calf'] },
      { id: 'quadriceps', label: 'Quadriceps', aliases: ['quadriceps', 'quads'] },
      { id: 'ileopsoas', label: 'Ileopsoas', aliases: ['ileopsoas', 'iliopsoas', 'hip flexors'] },
    ],
  },
]

export const MUSCLE_OPTIONS = MUSCLE_GROUPS.flatMap((group) => group.muscles)

export const MUSCLE_ALIASES_BY_ID = Object.fromEntries(
  MUSCLE_OPTIONS.map(({ id, aliases }) => [id, aliases.map((alias) => alias.toLowerCase())]),
)
