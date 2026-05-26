import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ArrowRight, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

const STORAGE_KEY = 'facilityos_module_card_order';

export default function ModuleCards({ modules, onSelect }) {
  const [ordered, setOrdered] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedKeys = JSON.parse(saved);
        const reordered = [];
        savedKeys.forEach((k) => {
          const mod = modules.find((m) => m.key === k);
          if (mod) reordered.push(mod);
        });
        modules.forEach((m) => {
          if (!reordered.find((r) => r.key === m.key)) reordered.push(m);
        });
        return reordered;
      }
    } catch { /* ignore */ }
    return modules;
  });

  useEffect(() => {
    setOrdered((prev) => {
      const reordered = [];
      prev.forEach((p) => {
        const mod = modules.find((m) => m.key === p.key);
        if (mod) reordered.push(mod);
      });
      modules.forEach((m) => {
        if (!reordered.find((r) => r.key === m.key)) reordered.push(m);
      });
      return reordered;
    });
  }, [modules]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(ordered);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setOrdered(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((i) => i.key)));
  };

  if (!ordered.length) return null;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="modules" direction="horizontal">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {ordered.map((mod, index) => {
              const Icon = mod.icon;
              return (
                <Draggable key={mod.key} draggableId={mod.key} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={snapshot.isDragging ? 'opacity-80 rotate-1 z-50' : ''}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(mod.mod)}
                        className={cn(
                          'w-full text-left border-2 rounded-xl hover:shadow-md transition-shadow h-full bg-gradient-to-br',
                          mod.color,
                          mod.border,
                        )}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className={cn('p-2 rounded-lg', mod.iconBg)}>
                              <Icon className="w-4 h-4 text-white" />
                            </div>
                            <div
                              {...dragProvided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500"
                              title="Drag to reorder"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">{mod.label}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">{mod.desc}</p>
                            </div>
                            <ArrowRight className={cn('w-4 h-4 flex-shrink-0 ml-2', mod.arrow)} />
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
