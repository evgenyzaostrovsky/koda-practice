import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { achievementThumbnailUrl, fallbackToOriginal } from "./assets";
const definition={id:"a",name:"A",condition:"A",rarity:"common" as const,rarity_ru:"Обычная",xp:1,reward:"",icon:"icons/a.png"};
it("builds versioned thumbnail paths and falls back to the original",()=>{expect(achievementThumbnailUrl(definition,"2.0")).toBe("/achievements/icons/a.thumb.webp?v=2.0");render(<img alt="award" src={achievementThumbnailUrl(definition,"2.0")} onError={(event)=>fallbackToOriginal(event,definition)}/>);fireEvent.error(screen.getByAltText("award"));expect(screen.getByAltText("award")).toHaveAttribute("src","/achievements/icons/a.png")});
