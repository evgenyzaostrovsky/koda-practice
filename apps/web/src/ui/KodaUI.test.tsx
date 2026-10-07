import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KodaButton, KodaIcon, KodaIconButton, kodaIconNames } from './index';

afterEach(cleanup);

describe('reusable KODA controls', () => {
  it('forwards the native ref and defaults to a non-submitting button inside a form', () => {
    const ref = createRef<HTMLButtonElement>();
    const submit = vi.fn(event => event.preventDefault());
    const click = vi.fn();
    const view = render(<form onSubmit={submit}><KodaButton ref={ref} onClick={click}>Запустить</KodaButton></form>);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Запустить' }));
    expect(ref.current).toHaveAttribute('type', 'button');
    fireEvent.click(ref.current!);
    expect(click).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    view.rerender(<form onSubmit={submit}><KodaButton type="submit">Отправить</KodaButton></form>);
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('announces loading, blocks repeat activation, and returns the original label when ready', () => {
    const click = vi.fn();
    const view = render(<KodaButton icon="Run" loading loadingLabel="Запуск выполняется" onClick={click}>Запустить</KodaButton>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAccessibleName('Запуск выполняется');
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
    view.rerender(<KodaButton icon="Run" onClick={click}>Запустить</KodaButton>);
    expect(button).toBeEnabled();
    expect(button).toHaveAccessibleName('Запустить');
    expect(button).not.toHaveAttribute('aria-busy');
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('preserves disabled explanations and native pressed state without leaking SVG names', () => {
    const click = vi.fn();
    render(<><KodaButton disabled aria-describedby="reason" icon="Check" onClick={click}>Проверить</KodaButton><p id="reason">Добавьте код</p><KodaIconButton icon="Hint" label="Открыть подсказку" aria-pressed /></>);
    const check = screen.getByRole('button', { name: 'Проверить' });
    expect(check).toHaveAccessibleDescription('Добавьте код');
    fireEvent.click(check);
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Открыть подсказку' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('forwards an icon-button ref and exposes its required accessible name', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<KodaIconButton ref={ref} icon="Reset" label="Сбросить результат" />);
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Сбросить результат' }));
    expect(ref.current).toHaveAttribute('type', 'button');
  });

  it('preserves caller-provided accessible names while loading icon-only actions', () => {
    render(<KodaIconButton icon="Save" label="Сохранить черновик" loading loadingLabel="Сохранение выполняется" />);
    expect(screen.getByRole('button', { name: 'Сохранить черновик' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Сохранение выполняется');
  });
});

describe('original SVG icon semantics', () => {
  it('hides decorative glyphs and gives separately titled glyphs unique label references', () => {
    const { container } = render(<><KodaIcon name="Run" /><KodaIcon name="Hint" title="Подсказка" /><KodaIcon name="Hint" title="Справка" /></>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const hint = screen.getByRole('img', { name: 'Подсказка' });
    const help = screen.getByRole('img', { name: 'Справка' });
    expect(hint.getAttribute('aria-labelledby')).not.toBe(help.getAttribute('aria-labelledby'));
    expect(hint).toHaveAttribute('focusable', 'false');
  });

  it('renders every published icon with scalable currentColor geometry', () => {
    const { container } = render(<>{kodaIconNames.map(name => <KodaIcon key={name} name={name} size={24} title={name} />)}</>);
    expect(new Set(kodaIconNames).size).toBe(kodaIconNames.length);
    for (const name of kodaIconNames) {
      const icon = screen.getByRole('img', { name });
      expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
      expect(icon).toHaveAttribute('stroke', 'currentColor');
      expect(icon).toHaveAttribute('width', '24');
      expect(icon.querySelector('path,rect,circle')).not.toBeNull();
    }
    expect(container.querySelectorAll('svg')).toHaveLength(kodaIconNames.length);
  });
});
