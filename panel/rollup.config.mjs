import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

// Single self-contained ES module, committed to the integration because
// HACS runs no build step.
export default {
  input: "src/energy-flow-mapper-panel.ts",
  output: {
    file: "../custom_components/energy_flow_mapper/frontend/energy-flow-mapper-panel.js",
    format: "es",
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    typescript({ include: ["src/**/*.ts"], noEmitOnError: true }),
    terser(),
  ],
};
