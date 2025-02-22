// App.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import "./App.css";

function App() {
  const [formData, setFormData] = useState({
    contractAddress: "",
    eventDef: "",
    fromBlock: "",
    toBlock: "",
    rpcEndpoint: "",
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 10;

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const provider = new ethers.JsonRpcProvider(formData.rpcEndpoint);

      const abi = [
        "event CooldownStarted(address indexed holder, uint256 assets, uint256 shares)",
      ];
      const contract = new ethers.Contract(
        formData.contractAddress,
        abi,
        provider
      );
      const eventInterface = contract.interface;
      const eventFragment = eventInterface.fragments[0];
      if (!eventFragment || eventFragment.type !== "event") {
        throw new Error("Invalid event definition");
      }

      const eventName = eventFragment.name;
      const filter = contract.filters[eventName]();

      const fromBlock = parseInt(formData.fromBlock);
      const toBlock = parseInt(formData.toBlock);

      console.log(fromBlock);
      console.log(toBlock);
      const logs = await contract.queryFilter(
        filter,
        isNaN(fromBlock) ? formData.fromBlock : fromBlock,
        isNaN(toBlock) ? formData.toBlock : toBlock
      );
      const parsedEvents = logs.map((log) => {
        const parsed = eventInterface.parseLog(log);
        return {
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          args: Object.fromEntries(
            parsed.fragment.inputs.map((input, i) => {
              const value = parsed.args[i];
              // Convert BigInt to string or number
              return [
                input.name,
                typeof value === "bigint" ? value.toString() : value,
              ];
            })
          ),
        };
      });

      setEvents(parsedEvents);
      setCurrentPage(1);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const indexOfLastEvent = currentPage * eventsPerPage;
  const indexOfFirstEvent = indexOfLastEvent - eventsPerPage;
  const currentEvents = events.slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil(events.length / eventsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="App">
      <h1>EVM Event Parser</h1>

      <div className="form-container">
        <div className="form-group">
          <label>Contract Address:</label>
          <input
            name="contractAddress"
            placeholder="e.g. 0x..."
            value={formData.contractAddress}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Event Definition (Solidity):</label>
          <textarea
            name="eventDef"
            placeholder="e.g. event CooldownStarted(address indexed holder, uint256 assets, uint256 shares)"
            value={formData.eventDef}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Start Block:</label>
          <input
            name="fromBlock"
            placeholder="Enter block number or 'earliest', 'latest', 'pending'"
            type="text"
            value={formData.fromBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>End Block:</label>
          <input
            name="toBlock"
            placeholder="Enter block number or 'earliest', 'latest', 'pending'"
            type="text"
            value={formData.toBlock}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>RPC Endpoint:</label>
          <input
            name="rpcEndpoint"
            placeholder="e.g. https://base-mainnet.g.al"
            value={formData.rpcEndpoint}
            onChange={handleInputChange}
          />
        </div>

        <button onClick={fetchEvents} disabled={loading}>
          {loading ? "Loading..." : "Parse Events"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {events.length > 0 && (
        <div className="results">
          <h2>Parsed Events ({events.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Transaction Hash</th>
                <th>Arguments</th>
              </tr>
            </thead>
            <tbody>
              {currentEvents.map((event, index) => (
                <tr key={index}>
                  <td>{event.blockNumber}</td>
                  <td>{event.txHash}</td>
                  <td>
                    <pre>{JSON.stringify(event.args, null, 2)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
