# Enhanced Vite React TypeScript Template

This template includes built-in detection for missing CSS variables between your Tailwind config and CSS files.

## Features

- **CSS Variable Detection**: Automatically detects if CSS variables referenced in `tailwind.config.cjs` are defined in `src/index.css`
- **Enhanced Linting**: Includes ESLint, Stylelint, and custom CSS variable validation
- **Shadcn/ui**: Pre-configured with all Shadcn components
- **Modern Stack**: Vite + React + TypeScript + Tailwind CSS

## Available Scripts

```bash
# Run all linting (includes CSS variable check)
npm run lint

# Check only CSS variables
npm run check:css-vars

# Individual linting
npm run lint:js    # ESLint
npm run lint:css   # Stylelint
```

## CSS Variable Detection

The template includes a custom script that:

1. **Parses `tailwind.config.cjs`** to find all `var(--variable)` references
2. **Parses `src/index.css`** to find all defined CSS variables (`--variable:`)
3. **Cross-references** them to find missing definitions
4. **Reports undefined variables** with clear error messages

### Example Output

When CSS variables are missing:
```
❌ Undefined CSS variables found in tailwind.config.cjs:
   --sidebar-background
   --sidebar-foreground
   --sidebar-primary

Add these variables to src/index.css
```

When all variables are defined:
```
✅ All CSS variables in tailwind.config.cjs are defined
```

## How It Works

The detection happens during the `npm run lint` command, which will:
- Exit with error code 1 if undefined variables are found
- Show exactly which variables need to be added to your CSS file
- Integrate seamlessly with your development workflow

This prevents runtime CSS issues where Tailwind classes reference undefined CSS variables.

---

## Running with Docker Compose

All three services (navigator API, camera/detection server, Vite frontend) start with a single command.

### 1. Create your `.env` file

```bash
cp .env.example .env
```

The defaults work out of the box for local development. Edit `NAVIGATOR_API_KEY` if you changed it in `navigator/main.py`.

### 2. Build and start

```bash
docker compose up --build
```

| Service | URL | Description |
|---------|-----|-------------|
| Navigator API | http://localhost:9000 | FastAPI occupancy REST API + demo panel |
| Camera server | http://localhost:8000 | Flask MJPEG stream + detection controls |
| Frontend | http://localhost:5173 | Vite React navigator app |

Admin page: **http://localhost:5173/admin**  
API docs: **http://localhost:9000/docs**

### 3. Stop

```bash
docker compose down
```

### Service dependency order

```
navigator (healthy) → gui_server
navigator (healthy) → frontend
```

The GUI server and frontend will not start until the navigator's `/health` endpoint returns 200. This avoids race-condition startup errors.

### Notes

- `gui_server` starts in `--mode mock` — no physical camera or GPIO required.
- The sensor reader (`scripts/sensor_reader/sensor_reader.py`) is a standalone script, not a Compose service. Run it separately on the Raspberry Pi with `NAVIGATOR_API_URL` pointing at the host running Docker.
- For production, swap `npm run dev -- --host` (Vite) for a proper static build served by nginx.