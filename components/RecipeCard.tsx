'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  totalCost: number;
}

export default function RecipeCard({ recipe, totalCost }: RecipeCardProps) {
  return (
    <Link href={`/recipes/${recipe.id}`}>
      <div className="bg-white rounded-2xl shadow-md overflow-hidden transition-transform hover:scale-105 active:scale-95">
        <div className="relative w-full h-48">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute top-2 right-2 bg-primary-orange text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
            {totalCost}円
          </div>
          <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            {recipe.cookTimeMinutes}分
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">
            {recipe.title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {recipe.description}
          </p>
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="bg-primary-green/20 text-primary-green text-xs px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

