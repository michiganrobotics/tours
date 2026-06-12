# Tours Project - Development Guidelines

## Important CSS Information

**⚠️ CRITICAL: Do NOT edit `public/styles.css` directly!**

- The `public/styles.css` file is automatically generated from `src/input.css`
- Always make CSS changes in `src/input.css`
- Run `npm run build:css` to rebuild styles.css from input.css
- Any changes made directly to styles.css will be overwritten

## Brand Colors

Use only these approved Michigan Robotics brand colors:

- **Primary Blue**: `#00274C` - Main brand color
- **Secondary Blue**: `#2F65A7` - Lighter blue accent
- **Purple**: `#702082` - Primary purple
- **Light Purple**: `#575294` - Secondary purple
- **Maize**: `#FFCB05` - University of Michigan yellow
- **Beige**: `#CFC096` - Neutral accent
- **Orange**: `#D86018` - Alert/action color

**Do NOT use**: Generic colors (purple, indigo, etc.) that aren't in our brand palette.

## CSS Build Process

1. Edit styles in `src/input.css`
2. Run `npm run build:css` to compile
3. The generated `public/styles.css` is what gets served

## Project Structure

- **Frontend**: Vanilla HTML/CSS/JS with Tailwind CSS
- **Backend**: Netlify Functions (serverless)
- **Database**: Google Sheets via Google Sheets API
- **Authentication**: JWT-based auth for admin dashboard
- **Forms**: Netlify Forms + custom API validation

## Key Files

- `src/input.css` - Source CSS file (edit this!)
- `public/styles.css` - Generated CSS (don't edit)
- `public/signup.html` - Public tour signup page
- `public/index.html` - Admin dashboard
- `netlify/functions/` - All API endpoints

## Development Workflow

1. Make changes to source files (`src/input.css`, HTML, JS)
2. Run `npm run build:css` if CSS changes were made
3. Test locally or deploy to staging
4. Commit and push changes

## CSS Specificity Rules

**⚠️ CRITICAL: Always check CSS specificity when adding new styles!**

CSS specificity hierarchy:
- Inline styles: 1000 points
- IDs: 100 points each
- Classes, attributes, pseudo-classes: 10 points each
- Elements, pseudo-elements: 1 point each

**Common specificity conflicts in this project:**
- `.bg-white .text-sm` = 20 points (2 classes)
- `.bg-white .rounded-lg` = 20 points (2 classes)
- `.text-blue-600` = 10 points (1 class)
- `button.audio-tour-btn` = 11 points (1 element + 1 class)

**Solution:** When adding new styles that aren't working, increase specificity by:
1. Adding parent class: `.bg-white .your-class`
2. Using element + class: `button.your-class`
3. Checking browser dev tools to see which rule is winning
4. Placing more specific rules AFTER less specific ones in CSS

**Example:**
```css
/* This loses to .bg-white .text-sm */
.text-blue-600 { color: blue; }

/* This wins */
.bg-white .text-blue-600 { color: blue; }
```