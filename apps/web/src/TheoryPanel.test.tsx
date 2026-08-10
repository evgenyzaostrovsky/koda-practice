import {fireEvent,render,screen} from '@testing-library/react';
import {describe,expect,it,vi} from 'vitest';
import {TheoryPanel} from './TheoryPanel';

const article={id:'theory-start-001',title:'Теория: DataFrame',introduction:'Краткое введение.',methods:[{name:'DataFrame',description:'Создаёт таблицу.',syntax:'pd.DataFrame(source)',keyParameters:[],parameterGuide:'Параметры не обязательны.',example:"frame = pd.DataFrame({'city': ['Тула']})",notes:['Исходные данные не меняются.'],documentationUrl:'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html',documentationLabel:'Официальная документация'}]};

describe('TheoryPanel',()=>{
 it('shows theory and opens official docs in a new tab',()=>{render(<TheoryPanel article={article} onClose={()=>{}}/>);expect(screen.getByRole('dialog')).toBeInTheDocument();const link=screen.getByRole('link',{name:/Официальная документация/});expect(link).toHaveAttribute('target','_blank');expect(link).toHaveAttribute('href',article.methods[0].documentationUrl)});
 it('closes on Escape without owning editor state',()=>{const close=vi.fn();render(<TheoryPanel article={article} onClose={close}/>);fireEvent.keyDown(window,{key:'Escape'});expect(close).toHaveBeenCalledOnce()});
});
