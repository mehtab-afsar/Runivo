interface Props {
  onSaved: () => void;
  onClose: () => void;
}

export default function AddShoe({ onClose }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <h2 className="text-xl font-semibold mb-2">Add Shoe</h2>
      <button onClick={onClose} className="mt-4 text-sm text-gray-400 underline">Close</button>
    </div>
  );
}
