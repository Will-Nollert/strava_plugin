// test/starredSegments.test.js - Tests for the starred segments content script

// Import the function to test
const {
  addWeatherAssistColumn,
} = require("../src/contentScripts/starredSegments");

// Mock DOM setup
function setupMockDOM() {
  // Create a basic starred segments table structure
  document.body.innerHTML = `
    <table class="starred-segments striped">
      <thead>
        <tr>
          <th class="centered">Star</th>
          <th>Sport</th>
          <th>Name</th>
          <th class="centered">Cat.</th>
          <th>Dist.</th>
          <th>Elev. Diff.</th>
          <th>Avg. Grade</th>
          <th>Men</th>
          <th>Women</th>
          <th>My PR</th>
          <th>My Goal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="centered">
            <div data-react-class="StarredSegment" data-react-props="{&quot;segmentId&quot;:1026244,&quot;experiments&quot;:{}}"></div>
          </td>
          <td>Ride</td>
          <td>
            <a href="/segments/1026244">NE A St to Slaughter Pen Rd.</a>
          </td>
          <td class="centered"></td>
          <td>0.3<abbr class="unit" title="miles"> mi</abbr></td>
          <td>137<abbr class="unit" title="feet"> ft</abbr></td>
          <td>7.2%</td>
          <td>52<abbr class="unit" title="second">s</abbr></td>
          <td>1:32</td>
          <td>1:34</td>
          <td>
            <a class="set-goal" data-segment-id="1026244" data-segment-name="NE A St to Slaughter Pen Rd." href="javascript:;">Set a Goal</a>
          </td>
        </tr>
        <tr>
          <td class="centered">
            <div data-react-class="StarredSegment" data-react-props="{&quot;segmentId&quot;:38652147,&quot;experiments&quot;:{}}"></div>
          </td>
          <td>Ride</td>
          <td>
            <a href="/segments/38652147">A Drag Race</a>
          </td>
          <td class="centered"></td>
          <td>1.6<abbr class="unit" title="miles"> mi</abbr></td>
          <td>160<abbr class="unit" title="feet"> ft</abbr></td>
          <td>0.6%</td>
          <td>4:07</td>
          <td>4:12</td>
          <td>4:13</td>
          <td>
            <a class="set-goal" data-segment-id="38652147" data-segment-name="A Drag Race" href="javascript:;">Set a Goal</a>
          </td>
        </tr>
      </tbody>
    </table>
  `;
}

// Reset the DOM after each test
afterEach(() => {
  document.body.innerHTML = "";
});

describe("Starred Segments Content Script", () => {
  beforeEach(() => {
    setupMockDOM();

    // Mock Math.random to return predictable values for testing
    const originalRandom = Math.random;
    jest.spyOn(Math, "random").mockImplementation(() => 0.1); // This will consistently choose 'Favorable'

    // Store the original for cleanup
    global._originalMathRandom = originalRandom;

    // Silence console logs/errors during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original Math.random and console methods
    Math.random = global._originalMathRandom;
    console.log.mockRestore();
    console.error.mockRestore();
  });

  test("adds Weather Assist column header", () => {
    // Count the initial number of headers
    const initialHeaders = document.querySelectorAll(
      "table.starred-segments thead th"
    );
    const initialCount = initialHeaders.length;

    addWeatherAssistColumn();

    const headers = document.querySelectorAll(
      "table.starred-segments thead th"
    );
    expect(headers.length).toBe(initialCount + 1); // Original count + our new one
    expect(headers[headers.length - 1].textContent).toBe("Weather Assist");
  });

  test("adds Weather Assist cells to each row", () => {
    // Count the initial number of cells in the first row
    const firstRow = document.querySelector("table.starred-segments tbody tr");
    const initialCellCount = firstRow.querySelectorAll("td").length;

    addWeatherAssistColumn();

    const rows = document.querySelectorAll("table.starred-segments tbody tr");
    expect(rows.length).toBe(2);

    // Check both rows have weather cells
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      expect(cells.length).toBe(initialCellCount + 1); // Original count + our new one

      const weatherCell = cells[cells.length - 1];
      expect(weatherCell).toBeTruthy();
      expect(weatherCell.textContent).toBe("Favorable"); // Since we mocked Math.random
      expect(weatherCell.style.color).toBe("green");
    });
  });

  test("extracts and stores segment IDs correctly", () => {
    addWeatherAssistColumn();

    const rows = document.querySelectorAll("table.starred-segments tbody tr");

    // Check first row
    let weatherCell = rows[0].querySelector("td:last-child");
    expect(weatherCell.dataset.segmentId).toBe("1026244");

    // Check second row
    weatherCell = rows[1].querySelector("td:last-child");
    expect(weatherCell.dataset.segmentId).toBe("38652147");
  });

  test("handles missing segment table gracefully", () => {
    // Clear the DOM and replace with empty div
    document.body.innerHTML = "<div>No table here</div>";

    // This shouldn't throw an error
    expect(() => {
      addWeatherAssistColumn();
    }).not.toThrow();

    // Verify the console error was called
    expect(console.error).toHaveBeenCalledWith(
      "Strava Plugin: Could not find starred segments table"
    );
  });
});
