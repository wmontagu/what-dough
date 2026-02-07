"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";

export function BudgetSlider({
  nameMin,
  nameMax,
  defaultMin = 20,
  defaultMax = 100,
}: {
  nameMin: string;
  nameMax: string;
  defaultMin?: number;
  defaultMax?: number;
}) {
  const [range, setRange] = useState([defaultMin, defaultMax]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm font-bold">
        <span>
          $<span className="text-money">{range[0]}</span>
        </span>
        <span>
          $<span className="text-money">{range[1]}</span>
        </span>
      </div>
      <Slider
        min={0}
        max={500}
        step={5}
        value={range}
        onValueChange={setRange}
        className="w-full"
      />
      <input type="hidden" name={nameMin} value={range[0]} />
      <input type="hidden" name={nameMax} value={range[1]} />
    </div>
  );
}
