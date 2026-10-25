import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

// Self-contained ES modules, committed to the integration because HACS runs
// no build step: the panel, the small card loader that every page loads, and
// the card, which the loader imports only when a dashboard shows it.
const OUT = "../custom_components/energy_flow_mapper/frontend";

const bundle = (input, file) => ({
  input,
  output: { file: `${OUT}/${file}`, format: "es", inlineDynamicImports: true },
  plugins: [
    nodeResolve(),
    typescript({ include: ["src/**/*.ts"], noEmitOnError: true }),
    terser(),
  ],
});

export default [
  bundle("src/energy-flow-mapper-panel.ts", "energy-flow-mapper-panel.js"),
  bundle("src/card-loader.ts", "energy-flow-mapper-card.js"),
  bundle("src/card.ts", "energy-flow-mapper-card-view.js"),
];
