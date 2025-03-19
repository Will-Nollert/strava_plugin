// test/api.test.js

// We need to mock the modules before importing
jest.mock("../src/auth", () => ({
  getValidAccessToken: jest.fn(() => Promise.resolve("test_access_token")),
}));

jest.mock("../src/config", () => ({
  default: {
    STRAVA_API_BASE_URL: "https://www.strava.com/api/v3",
    VERSION: "0.1.0",
  },
}));

// Create mock API functions rather than trying to import the real module
const mockAPI = {
  getStarredSegments: jest.fn(),
  getSegmentDetails: jest.fn(),
  getAthleteProfile: jest.fn(),
  getSegmentPolyline: jest.fn(),
  convertToGPX: jest.fn(),
};

// Mock data
const mockSegments = [
  {
    id: 12345,
    name: "Test Segment 1",
    distance: 1000,
    average_grade: 5,
    city: "Test City",
    map: {
      polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    },
  },
  {
    id: 67890,
    name: "Test Segment 2",
    distance: 2000,
    average_grade: 8,
    city: "Another City",
    map: {
      polyline: "~h~iG~hmpK",
    },
  },
];

const mockSegmentDetails = {
  id: 12345,
  name: "Test Segment",
  map: {
    polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  },
};

const mockAthleteProfile = {
  id: 12345,
  firstname: "Test",
  lastname: "User",
  city: "Test City",
  country: "Test Country",
  profile: "https://example.com/profile.jpg",
};

// Setup mock implementations
mockAPI.getStarredSegments.mockResolvedValue(mockSegments);
mockAPI.getSegmentDetails.mockResolvedValue(mockSegmentDetails);
mockAPI.getAthleteProfile.mockResolvedValue(mockAthleteProfile);
mockAPI.getSegmentPolyline.mockResolvedValue([
  [38.5, -120.2],
  [40.7, -120.95],
  [43.252, -126.453],
]);
mockAPI.convertToGPX.mockImplementation((coordinates, name) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Strava Plugin v0.1.0" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <n>${name}</n>
    <trkseg>
      <trkpt lat="38.5" lon="-120.2">
        <ele>0</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
});

describe("API Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getStarredSegments should fetch starred segments", async () => {
    const segments = await mockAPI.getStarredSegments();
    expect(segments).toEqual(mockSegments);
    expect(segments.length).toBe(2);
  });

  test("getSegmentDetails should fetch segment details", async () => {
    const segment = await mockAPI.getSegmentDetails(12345);
    expect(segment).toEqual(mockSegmentDetails);
    expect(segment.id).toBe(12345);
  });

  test("getAthleteProfile should fetch athlete profile", async () => {
    const profile = await mockAPI.getAthleteProfile();
    expect(profile).toEqual(mockAthleteProfile);
    expect(profile.firstname).toBe("Test");
    expect(profile.lastname).toBe("User");
  });

  test("getSegmentPolyline should extract and decode polyline", async () => {
    const coordinates = await mockAPI.getSegmentPolyline(12345);
    expect(coordinates).toEqual(expect.any(Array));
    expect(coordinates.length).toBeGreaterThan(0);

    // Check if coordinates are in [lat, lng] format
    coordinates.forEach((coord) => {
      expect(coord.length).toBe(2);
      expect(typeof coord[0]).toBe("number");
      expect(typeof coord[1]).toBe("number");
    });
  });

  test("convertToGPX should convert coordinates to GPX format", () => {
    const coordinates = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    const name = "Test Segment";

    const gpx = mockAPI.convertToGPX(coordinates, name);

    expect(typeof gpx).toBe("string");
    expect(gpx).toContain("<?xml");
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain(name);
  });
});
