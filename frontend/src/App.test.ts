import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import App from './App';

describe('App', () => {
    it('renders without auth actions and exposes the case library navigation', () => {
        const html = renderToStaticMarkup(React.createElement(App));

        expect(html).toContain('案例库');
        expect(html).not.toContain('Login');
    });
});
