use std::ops::{Add, Sub, Mul, Div};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        let dx = other.x - self.x;
        let dy = other.y - self.y;
        (dx * dx + dy * dy).sqrt()
    }

    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

impl Sub for Point2D {
    type Output = Self;

    fn sub(self, other: Self) -> Self {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

impl Add for Point2D {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}

impl Mul<f64> for Point2D {
    type Output = Self;

    fn mul(self, scalar: f64) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
        }
    }
}

impl Div<f64> for Point2D {
    type Output = Self;

    fn div(self, scalar: f64) -> Self {
        Self {
            x: self.x / scalar,
            y: self.y / scalar,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Timestamp(pub f64); // milliseconds

impl Timestamp {
    pub fn new(millis: f64) -> Self {
        Self(millis)
    }

    pub fn as_millis(&self) -> f64 {
        self.0
    }

    pub fn as_seconds(&self) -> f64 {
        self.0 / 1000.0
    }
    
    pub fn is_valid(&self) -> bool {
        self.0 >= 0.0 && self.0.is_finite()
    }

    pub fn duration_since(&self, earlier: &Timestamp) -> Option<f64> {
        if self.0 >= earlier.0 {
            Some(self.0 - earlier.0)
        } else {
            None
        }
    }
}

impl Sub for Timestamp {
    type Output = f64; // milliseconds

    fn sub(self, other: Self) -> f64 {
        self.0 - other.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Velocity2D {
    pub x: f64, // pixels per second
    pub y: f64, // pixels per second
}

impl Velocity2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn from_points_and_time(start: Point2D, end: Point2D, dt_ms: f64) -> Option<Self> {
        if dt_ms <= 0.0 || !dt_ms.is_finite() {
            return None;
        }
        
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let dt_seconds = dt_ms / 1000.0;
        
        Some(Self {
            x: dx / dt_seconds,
            y: dy / dt_seconds,
        })
    }

    pub fn speed(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }

    pub fn normalized(&self) -> Option<Self> {
        let speed = self.speed();
        if speed > f64::EPSILON {
            Some(Self {
                x: self.x / speed,
                y: self.y / speed,
            })
        } else {
            None
        }
    }
}

impl Mul<f64> for Velocity2D {
    type Output = Self;

    fn mul(self, scalar: f64) -> Self {
        Self {
            x: self.x * scalar,
            y: self.y * scalar,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TouchPoint {
    pub position: Point2D,
    pub timestamp: Timestamp,
}

impl TouchPoint {
    pub fn new(x: f64, y: f64, timestamp_ms: f64) -> Option<Self> {
        let timestamp = Timestamp::new(timestamp_ms);
        if timestamp.is_valid() {
            Some(Self {
                position: Point2D::new(x, y),
                timestamp,
            })
        } else {
            None
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Prediction {
    pub position: Point2D,
    pub confidence: f64, // 0.0 to 1.0
}

impl Prediction {
    pub fn new(position: Point2D, confidence: f64) -> Self {
        Self {
            position,
            confidence: confidence.clamp(0.0, 1.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point2d_operations() {
        let p1 = Point2D::new(3.0, 4.0);
        let p2 = Point2D::new(6.0, 8.0);

        assert_eq!(p1.magnitude(), 5.0);
        assert_eq!(p1.distance_to(&p2), 5.0);

        let p3 = p2 - p1;
        assert_eq!(p3.x, 3.0);
        assert_eq!(p3.y, 4.0);

        let p4 = p1 * 2.0;
        assert_eq!(p4.x, 6.0);
        assert_eq!(p4.y, 8.0);
    }

    #[test]
    fn test_timestamp_validation() {
        let t1 = Timestamp::new(100.0);
        assert!(t1.is_valid());

        let t2 = Timestamp::new(-50.0);
        assert!(!t2.is_valid());

        let t3 = Timestamp::new(f64::INFINITY);
        assert!(!t3.is_valid());
    }

    #[test]
    fn test_velocity_from_points() {
        let p1 = Point2D::new(0.0, 0.0);
        let p2 = Point2D::new(100.0, 0.0);
        
        let v = Velocity2D::from_points_and_time(p1, p2, 100.0).unwrap();
        assert_eq!(v.x, 1000.0); // 100 pixels / 0.1 seconds = 1000 px/s
        assert_eq!(v.y, 0.0);
        assert_eq!(v.speed(), 1000.0);
    }
}