import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagMultiSelect } from './tag-multi-select';

const TAGS = [
  { id: 't1', name: 'Business' },
  { id: 't2', name: 'News' },
  { id: 't3', name: 'Science' },
];

describe('TagMultiSelect', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<TagMultiSelect options={TAGS} value={[]} onChange={() => {}} placeholder="Pick tags" />);
    expect(screen.getByText('Pick tags')).toBeInTheDocument();
  });

  it('reports the tag id when an option is chosen', () => {
    const onChange = vi.fn();
    render(<TagMultiSelect options={TAGS} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    fireEvent.click(screen.getByText('News'));
    expect(onChange).toHaveBeenCalledWith(['t2']);
  });

  it('filters options by search query', () => {
    render(<TagMultiSelect options={TAGS} value={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    fireEvent.change(screen.getByPlaceholderText(/search tags/i), { target: { value: 'sci' } });
    expect(screen.getByText('Science')).toBeInTheDocument();
    expect(screen.queryByText('Business')).not.toBeInTheDocument();
  });

  it('deselects an already selected tag', () => {
    const onChange = vi.fn();
    render(<TagMultiSelect options={TAGS} value={['t1']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    // "Business" appears as a chip and as an option; clicking the option toggles it off.
    const options = screen.getAllByText('Business');
    fireEvent.click(options[options.length - 1]);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('appends a second tag (multi-select) without closing', () => {
    const onChange = vi.fn();
    render(<TagMultiSelect options={TAGS} value={['t1']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    fireEvent.click(screen.getByText('Science'));
    expect(onChange).toHaveBeenCalledWith(['t1', 't3']);
    // Popover stays open: the search box is still rendered.
    expect(screen.getByPlaceholderText(/search tags/i)).toBeInTheDocument();
  });

  it('clears all selected tags from the footer', () => {
    const onChange = vi.fn();
    render(<TagMultiSelect options={TAGS} value={['t1', 't2']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    // Footer button is "Clear all" (the trigger's icon button is "Clear all tags").
    fireEvent.click(screen.getByRole('button', { name: /^clear all$/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('selects all filtered options when enabled', () => {
    const onChange = vi.fn();
    render(<TagMultiSelect options={TAGS} value={[]} onChange={onChange} allowSelectAll />);
    fireEvent.click(screen.getByRole('button', { name: /select topic tags/i }));
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(onChange).toHaveBeenCalledWith(['t1', 't2', 't3']);
  });
});
