import { createApp } from './api/app';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`beamline API listening on http://localhost:${port}`);
});
