import {beforeEach,describe,expect,it} from 'vitest';
import {getTheme,initializeTheme,setTheme,THEMES} from './index';

describe('theme registry',()=>{
  beforeEach(()=>{localStorage.clear();delete document.documentElement.dataset.theme});
  it('uses and persists the airy theme by default',()=>{
    initializeTheme();
    expect(getTheme()).toBe(THEMES.airy.id);
    expect(document.documentElement.dataset.theme).toBe('airy');
  });
  it('switches to another registered theme',()=>{
    setTheme(THEMES.neutralLight.id);
    expect(getTheme()).toBe('neutral-light');
    expect(document.documentElement.dataset.theme).toBe('neutral-light');
  });
});
