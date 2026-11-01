"""Dependency-light browser interaction regression checks (Playwright is CI-only)."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.getenv('SUDOKU_UI_URL')
HTML = (Path(__file__).parents[1] / 'www' / 'index.html').read_text()


def visit(browser, width, height):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1,
                              has_touch=True, is_mobile=True, reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    if URL:
        page.goto(URL, wait_until='domcontentloaded')
    else:
        # Local environments can disable loopback/URL navigation. HTML injection
        # still validates layout/controls but cannot exercise true persistence.
        page.set_content(HTML, wait_until='domcontentloaded')
    page.wait_for_selector('.cell:nth-child(81)')
    return ctx, page, errors


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=os.getenv('SUDOKU_CHROMIUM_PATH') or None, args=['--no-sandbox'])
    for width, height in [(360, 640), (360, 740), (412, 915), (768, 1024)]:
        ctx, page, errors = visit(browser, width, height)
        layout = page.evaluate('''() => ({
          board: document.querySelector('.board-wrapper').getBoundingClientRect().width,
          key: document.querySelector('.num-btn').getBoundingClientRect().width,
          bodyScroll: document.documentElement.scrollHeight - innerHeight,
          horizontalScroll: document.documentElement.scrollWidth - innerWidth,
          lastControlBottom: document.getElementById('btn-auto-notes').getBoundingClientRect().bottom
        })''')
        assert layout['board'] >= 230, (width, height, layout)
        assert layout['key'] >= 32, (width, height, layout)
        assert layout['horizontalScroll'] <= 1, (width, height, layout)
        pad = page.locator('.num-btn').evaluate_all('els => els.map(e => ({y:Math.round(e.getBoundingClientRect().top), w:Math.round(e.getBoundingClientRect().width)}))')
        assert len(pad) == 9 and len({k['y'] for k in pad}) == 1, (width, height, pad)
        assert max(k['w'] for k in pad)-min(k['w'] for k in pad) <= 1, (width, height, pad)
        assert layout['bodyScroll'] <= 4, (width, height, layout)
        assert not errors, errors
        print(f'PASS {width}x{height}: board={layout["board"]:.0f} keypad={layout["key"]:.0f} scroll={layout["bodyScroll"]:.0f}')
        ctx.close()

    ctx, page, errors = visit(browser, 360, 740)
    # A wrongly entered or even correct digit is a meaningful move that must
    # survive canceling a difficulty change, New Puzzle, or Android Back.
    square = page.locator('.cell:not(.given)').first
    idx = int(square.get_attribute('data-idx'))
    square.click()
    page.locator('.num-btn').first.click()
    previous = page.locator('.cell').nth(idx).inner_text()
    assert previous == '1', previous
    page.locator('[data-diff="medium"]').click()
    assert 'open' in (page.locator('#modal-confirm').get_attribute('class') or '')
    page.locator('#btn-confirm-cancel').click()
    assert page.locator('.cell').nth(idx).inner_text() == previous
    assert page.locator('.diff-chip.active').get_attribute('data-diff') == 'easy'
    page.locator('[data-diff="easy"]').click()
    assert page.locator('.modal-backdrop.open').count() == 0, 'Selected difficulty cannot restart game'
    page.locator('#btn-new-game').click()
    assert page.locator('#modal-confirm.open').count() == 1
    assert page.evaluate('window.pureSudokuHandleBack()') is True
    assert page.locator('.modal-backdrop.open').count() == 0
    page.locator('[data-diff="medium"]').click()
    page.locator('#btn-confirm-yes').click()
    assert page.locator('.diff-chip.active').get_attribute('data-diff') == 'medium'

    page.locator('#btn-fast-mode').click()
    assert page.locator('.num-btn[aria-pressed="true"]').count() == 0, 'Number-first cannot preselect a digit'
    page.locator('#btn-notes').click()
    assert page.locator('#btn-notes').get_attribute('aria-pressed') == 'true'
    page.locator('#btn-settings').click()
    page.locator('#toggle-check-mistakes').click()
    assert page.locator('#toggle-check-mistakes').get_attribute('aria-checked') == 'false'
    page.locator('#toggle-haptics').click()
    assert page.locator('#toggle-haptics').get_attribute('aria-checked') == 'false'
    page.locator('[data-close="modal-settings"]').first.click()

    page.locator('#btn-stats').click()
    page.locator('#btn-reset-stats').click()
    assert page.locator('#modal-confirm.open').count() == 1
    page.locator('#btn-confirm-cancel').click()
    assert page.locator('#modal-stats.open').count() == 1
    assert page.evaluate('window.pureSudokuHandleBack()') is True
    assert page.locator('.modal-backdrop.open').count() == 0
    assert page.evaluate('window.pureSudokuHandleBack()') is True
    assert page.locator('#pause-overlay.active').count() == 1
    assert page.evaluate('window.pureSudokuHandleBack()') is False
    if URL:
        page.reload(wait_until='domcontentloaded')
        page.wait_for_selector('.cell:nth-child(81)')
        assert page.locator('#pause-overlay.active').count() == 1, 'Saved session must reopen paused'
    assert not errors, errors
    print('PASS UI interactions: undoable placement, reset confirmation, notes, fast mode, settings, Back/pause')
    ctx.close()
    browser.close()
