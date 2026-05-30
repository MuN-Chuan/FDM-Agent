import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
    it('shows chat and case library as primary navigation items', () => {
        const html = renderToStaticMarkup(
            React.createElement(Sidebar, {
                currentPage: 'chat',
                currentSessionId: null,
                onNavigate: () => {},
                onSessionChange: () => {},
            }),
        );

        expect(html).toContain('AI 答疑');
        expect(html).toContain('案例库');
    });
});
