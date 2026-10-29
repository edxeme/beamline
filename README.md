# beamline

Quick statics for everyday beams. Define a span, place point and uniform loads, and read reactions, shear and moment diagrams — computed by a small TypeScript solver, served over a REST API, and visualized in a React playground.

I spent my first career around structures, and I kept wanting a small, honest tool for the kind of statics that comes up constantly: simply supported spans and cantilevers under everyday loads. So I built one. The diagrams it draws obey the same sign conventions my old mechanics professor drilled into us — loads positive downward, sagging moment positive — and the solver is checked against the textbook closed-form cases.

## How it fits together

```
src/
  core/    Domain: beam solver + unit conversions (pure TypeScript, fully unit-tested)
  api/     REST layer: Express 5 app, hand-rolled validation, structured errors
  server.ts  HTTP entrypoint (PORT env, default 3000)
  web/     Playground: React 19 + Vite, SVG diagrams, typed API client
```

The core never imports from `api/` or `web/`, so it can be lifted into a library unchanged. The API is stateless — every request carries the full beam definition.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness check |
| POST | `/api/v1/beams/analysis` | Solve a beam, get reactions + sampled diagrams |
| GET | `/api/v1/convert` | Convert force/length values between units |

Analyze a 6 m simply supported beam with a 10 kN point load at midspan:

```bash
curl -s -X POST http://localhost:3000/api/v1/beams/analysis \
  -H 'Content-Type: application/json' \
  -d '{
    "length": 6,
    "supports": [
      { "kind": "pin", "position": 0 },
      { "kind": "roller", "position": 6 }
    ],
    "loads": [{ "kind": "point", "magnitude": 10, "position": 3 }]
  }'
```

The response carries `reactions` (with the fixing moment for cantilevers), 401 `samples` of shear and moment along the span, and the `maxSagging` / `maxHogging` peaks.

Errors are structured, never vague:

```json
{
  "error": {
    "code": "load/out-of-span",
    "message": "Point load at 9 m is outside the span."
  }
}
```

Convert 2 kip to kilonewtons:

```bash
curl -s "http://localhost:3000/api/v1/convert?quantity=force&value=2&from=kip&to=kN"
```

## Design notes

- **Sign conventions.** Downward loads are positive; shear is the net upward force left of a section; moment is positive in sagging. The same convention everywhere: solver, API payloads, drawings.
- **Sampled diagrams.** Shear and moment are sampled at 400 intervals rather than solved symbolically. For visualization that is plenty; peak values are reported from the samples, so expect them to sit within a span/400 of the true section.
- **Cantilevers.** A cantilever fixed at the right end is solved as its mirror image, so the left-to-right sweep only handles one orientation. The test suite pins this invariant.
- **Validation.** Hand-rolled type guards instead of a schema library — the payloads are small, the rules are domain-specific, and every rejection lists the offending fields.
- **Statically determinate only.** Two pin/roller supports or one fixed support. Continuous beams are out of scope on purpose; indeterminate analysis deserves its own tool.

## Development

```bash
npm install

npm run dev:api    # Express API on :3000 (tsx watch)
npm run dev:web    # Vite playground on :5173 (proxies /api → :3000)
npm run test       # Vitest, 20 tests across core and API
npm run typecheck  # strict TypeScript, noUncheckedIndexedAccess included
npm run build      # production web bundle into dist/
```

## License

[MIT](LICENSE)
