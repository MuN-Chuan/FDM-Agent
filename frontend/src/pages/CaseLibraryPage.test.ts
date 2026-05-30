import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CaseLibraryPage } from './CaseLibraryPage';

describe('CaseLibraryPage', () => {
    it('renders the case library heading', () => {
        const html = renderToStaticMarkup(React.createElement(CaseLibraryPage));

        expect(html).toContain('FDM Case Library');
        expect(html).toContain('Defect Category');
    });
});
