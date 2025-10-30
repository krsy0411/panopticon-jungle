# Styles

전역 스타일 및 CSS/SCSS 파일

## 예시

```css
/* styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --spacing-unit: 8px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, sans-serif;
}

/* styles/variables.css */
:root {
  --max-width: 1200px;
  --border-radius: 8px;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
}

/* styles/mixins.scss */
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

@mixin respond-to($breakpoint) {
  @if $breakpoint == 'mobile' {
    @media (max-width: 640px) { @content; }
  }
  @else if $breakpoint == 'tablet' {
    @media (max-width: 1024px) { @content; }
  }
}
```
