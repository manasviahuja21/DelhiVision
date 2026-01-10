import { useState } from "react";
import "./WardSearch.css";

const WardSearch = ({ wards = [], onWardSelect }) => {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  console.log("WardSearch wards prop:", wards);

  const filteredWards = wards.filter((ward) =>
    ward.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (ward) => {
    setQuery("");
    setShowDropdown(false);
    onWardSelect(ward.toUpperCase()); // CAPS as required
  };

  return (
    <div className="ward-search-container">
      <input
        type="text"
        placeholder="Search ward (e.g. Sarita Vihar)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        className="ward-search-input"
      />

      {showDropdown && query && (
        <div className="ward-search-dropdown">
          {filteredWards.length > 0 ? (
            filteredWards.map((ward, idx) => (
              <div
                key={idx}
                className="ward-search-item"
                onClick={() => handleSelect(ward)}
              >
                🔍 {ward}
              </div>
            ))
          ) : (
            <div className="ward-search-no-result">
              No wards found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WardSearch;
